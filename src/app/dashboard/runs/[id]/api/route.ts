import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { screenshot, tasks, history, persona, currentProgress, runIndex } = await req.json();

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot is required" }, { status: 400 });
    }

    // Build base system prompt
    const totalTasks = tasks.length;
    let systemPrompt = `You are a helpful assistant that will simulate UI/UX usability testing. You will be given two functions that link to a FastAPI backend endpoint for clicking and receiving a screenshot of the screen. Using those two tools, you will attempt to complete the tasks given to you by navigating the Figma UI via those two endpoints. 

      **TEST GOAL:** ${goal || "Evaluate the usability and effectiveness of the design"}

      **YOUR PRIMARY GOAL:** Complete ALL ${totalTasks} tasks listed below:
      ${tasks.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

      You are simulating the following persona:
      Name: ${persona?.name || "Unknown"}
      Role: ${persona?.variant || persona?.role || "User"}
      ${persona?.description ? `Context: ${persona.description}` : ""}

      **TASK COMPLETION TRACKING:**
      - Keep track of which tasks you have successfully completed
      - A task is "completed" only when you have achieved its stated goal
      - Do NOT submit findings until you have attempted ALL ${totalTasks} tasks
      - You must make genuine attempts to complete each task before submitting

      **NAVIGATION RULES:**
      - Analyze the screenshot and decide the next action
      - If you see an element that helps complete the current task, click it
      - If you are unsure, you can click to explore or wait
      - If a task is complete, move to the next one
      - Don't ever ask the user for questions or clarification. Just choose a path and continue
      - There may be a red dot on the screen, which shows a previous place you tried to click. You can use that to guide your next click if it was missed
      - If the message history shows you've tried the same action more than 3 times, you should try a different action
      - **IMPORTANT: Click Feedback**: After each click, you will receive feedback about whether the screen changed. If you click the same location multiple times and the screen does NOT change, this means the click had no effect. You MUST try a different element or approach. Do not keep clicking the same location if it's not working.
      - If you receive an error message saying "the screen did not change" after clicking, you must immediately try a different element or approach

      **SUBMITTING FINDINGS:**
      - ONLY use 'submit_findings' when you have attempted ALL ${totalTasks} tasks OR when time is up
      - In taskCompletionPercentage, honestly report: (number of tasks you actually completed / ${totalTasks}) * 100
      - Example: If you completed 2 out of ${totalTasks} tasks, report ${totalTasks > 0 ? Math.round((2 / totalTasks) * 100) : 0}%
      - Example: If you completed all ${totalTasks} tasks, report 100%
      - Base this on ACTUAL task completion, not just progress through the UI
      - Provide detailed, constructive feedback in the findings
      - Note: Your findings will be automatically enhanced by a Design Intelligence Platform that includes UX experts, accessibility specialists, and conversion experts. They will add knowledge citations and developer outputs to your findings.

      **IMPORTANT RESTRICTIONS:**
      - Never click on "Continue with Google" or any other element outside the prototype screen
      - You should only be clicking within the device boundaries
      - Do NOT submit findings prematurely - you must attempt all tasks first

      You have access to a 'click' tool. Use it to interact with the interface.
      The screenshot is the current state of the browser.`;

    // At 94% progress, instruct agent to submit findings
    if (currentProgress !== undefined && currentProgress >= 94) {
      systemPrompt += `\n\n⏰ TIME IS RUNNING OUT: The test is at ${currentProgress}% progress. You MUST now:
      1. Evaluate which tasks you have actually completed (not just attempted)
      2. Count: How many of the ${totalTasks} tasks did you successfully complete?
      3. Calculate taskCompletionPercentage: (completed tasks / ${totalTasks}) * 100
      4. Use 'submit_findings' immediately with your honest assessment
      5. Be specific in your findings about what worked and what didn't`;
    }

    const isOvertime = currentProgress !== undefined && currentProgress >= 94;
    const userMessageContent = isOvertime
      ? "TIME IS UP. The test session has ended. Do not click anything else. You MUST call 'submit_findings' immediately to report your results."
      : "Here is the current screen";

    // OpenAI message types
    type OpenAIMessage =
      | { role: "system"; content: string }
      | {
          role: "user";
          content:
            | string
            | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
        }
      | { role: "assistant"; content?: string | null; tool_calls?: unknown[] }
      | { role: "tool"; tool_call_id: string; content: string };

    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...(history || []).filter(
        (h: OpenAIMessage | null | undefined): h is OpenAIMessage => h !== null && h !== undefined
      ),
      {
        role: "user",
        content: [
          { type: "text", text: userMessageContent },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${screenshot}`,
            },
          },
        ],
      },
    ];

    // Use configured OpenAI model
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    console.log(`[OpenAI] Making API call to ${model} with`, messages.length, "messages");

    // Add variation based on run index to make each run produce different findings
    // Temperature ranges from 0.7 (more focused) to 1.0 (more creative) based on run index
    const temperature = runIndex !== undefined ? 0.7 + (runIndex % 3) * 0.1 : 0.8;
    
    // Add run-specific context to prompt for variation
    const runContext = runIndex !== undefined 
      ? `\n\n**NOTE: This is run ${runIndex + 1} of multiple runs. Your behavior and findings should reflect natural variation - different users may notice different issues or approach tasks differently. Be authentic to this specific run's experience.**`
      : '';

    // Update system prompt with run context
    if (runContext) {
      messages[0] = {
        role: "system",
        content: (messages[0] as { role: string; content: string }).content + runContext,
      };
    }

    const response = await openai.chat.completions.create({
      model: model,
      messages: messages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
      temperature: temperature,
      tools: [
        {
          type: "function",
          function: {
            name: "click",
            description: "Click at a specific coordinate on the screen",
            parameters: {
              type: "object",
              properties: {
                x: {
                  type: "number",
                  description: "The x coordinate to click",
                },
                y: {
                  type: "number",
                  description: "The y coordinate to click",
                },
                rationale: {
                  type: "string",
                  description:
                    "A brief explanation of why you are clicking here and what you expect to happen",
                },
              },
              required: ["x", "y", "rationale"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_screenshot",
            description: "Get the screenshot for the current view of the browser",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "submit_findings",
            description: "Submit the final usability findings when all tasks are complete.",
            parameters: {
              type: "object",
              properties: {
                taskCompletionPercentage: {
                  type: "number",
                  description:
                    `Percentage of tasks successfully completed (0-100). Calculate as: (number of tasks you actually completed / ${totalTasks}) * 100. Be honest - if you completed 0 tasks, report 0. If you completed all ${totalTasks} tasks, report 100. Base this ONLY on actual task completion, not attempts or progress.`,
                },
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Short title of the finding",
                      },
                      severity: {
                        type: "string",
                        enum: ["High", "Med", "Low"],
                        description: "Severity of the issue",
                      },
                      confidence: {
                        type: "number",
                        description: "Confidence score 0-100",
                      },
                      description: {
                        type: "string",
                        description: "Detailed description of the issue",
                      },
                      suggestedFix: {
                        type: "string",
                        description: "Suggested fix for the issue",
                      },
                      affectingTasks: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of tasks affected",
                      },
                    },
                    required: [
                      "title",
                      "severity",
                      "confidence",
                      "description",
                      "suggestedFix",
                      "affectingTasks",
                    ],
                  },
                },
                nextSteps: {
                  type: "object",
                  description: "Categorized next steps and recommendations",
                  properties: {
                    userExperience: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "User experience improvements (e.g., loading states, visual feedback, animations)",
                    },
                    informationArchitecture: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Information architecture improvements (e.g., navigation, content organization, labeling)",
                    },
                    accessibility: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Accessibility improvements (e.g., keyboard navigation, screen reader support, color contrast)",
                    },
                  },
                  required: ["userExperience", "informationArchitecture", "accessibility"],
                },
                generalFeedback: {
                  type: "string",
                  description: "Overall feedback and summary of the session",
                },
              },
              required: ["taskCompletionPercentage", "findings", "nextSteps", "generalFeedback"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const toolCalls = choice.message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      return NextResponse.json({
        action: "tool_call",
        tool_calls: toolCalls,
        message: choice.message,
      });
    }

    return NextResponse.json({
      action: "message",
      content: choice.message.content,
      message: choice.message,
    });
  } catch (error) {
    console.error("Agent error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
