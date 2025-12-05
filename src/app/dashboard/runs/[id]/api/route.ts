import { OpenAI } from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { screenshot, tasks, history, persona, currentProgress } = await req.json()

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot is required" }, { status: 400 })
    }

    // Build base system prompt
    let systemPrompt = `You are a helpful assistant that will simulate UI/UX usability testing. You will be given two functions that link to a Flask API endpoint for clicking and receiving a screenshot of the screen. Using those two tools, you will attempt to complete the tasks given to you by navigating the Figma UI via those two endpoints. Your goal is to complete the following tasks on the provided UI:
      ${tasks.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

      You are simulating the following persona:
      Name: ${persona?.name || "Unknown"}
      Role: ${persona?.variant || persona?.role || "User"}
      ${persona?.description ? `Context: ${persona.description}` : ""}

      Analyze the screenshot and decide the next action.
      - If you see an element that helps complete the current task, click it.
      - If you are unsure, you can click to explore or wait.
      - If the task is complete, move to the next one.
      - Don't ever ask the user for questions or clarification. Just choose a path and continue.
      - There may be a red dot on the screen, which shows a previous place you tried to click. You can use that to guide your next click if it was missed.
      - If the message history shows you've tried the same action more than 3 times, you should try a different action.
      - When you have completed all tasks, you MUST use the 'submit_findings' tool to report your findings. Do not just say "Done".
      - Provide detailed, constructive feedback in the findings.

      NOTE: Never click on "Continue with Google" or any other element outside the prototype screen.
      You should only be clicking within the device boundaries.

      You have access to a 'click' tool. Use it to interact with the interface.
      The screenshot is the current state of the browser.`

    // At 98% progress, instruct agent to submit findings
    if (currentProgress !== undefined && currentProgress >= 94) {
      systemPrompt += `\n\nIMPORTANT: The test is nearing completion (${currentProgress}% progress). You should now evaluate your performance and use the 'submit_findings' tool to report your results. In the taskCompletionPercentage field, honestly assess what percentage of the tasks you successfully completed (0-100). For example, if you completed 2 out of 3 tasks, report 67. If you completed all tasks, report 100. Base this on actual task completion, not just progress through the UI.`
    }

    const isOvertime = currentProgress !== undefined && currentProgress >= 94
    const userMessageContent = isOvertime 
      ? "TIME IS UP. The test session has ended. Do not click anything else. You MUST call 'submit_findings' immediately to report your results."
      : "Here is the current screen"

    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...(history || []).filter((h: any) => h !== null && h !== undefined),
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
    ]

    console.log("[OpenAI] Making API call to gpt-4.1 with", messages.length, "messages")
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
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
                  description: "A brief explanation of why you are clicking here and what you expect to happen",
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
                  description: "Percentage of tasks successfully completed (0-100). Honestly assess based on actual task completion."
                },
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Short title of the finding" },
                      severity: { type: "string", enum: ["High", "Med", "Low"], description: "Severity of the issue" },
                      confidence: { type: "number", description: "Confidence score 0-100" },
                      description: { type: "string", description: "Detailed description of the issue" },
                      suggestedFix: { type: "string", description: "Suggested fix for the issue" },
                      affectingTasks: { type: "array", items: { type: "string" }, description: "List of tasks affected" },
                    },
                    required: ["title", "severity", "confidence", "description", "suggestedFix", "affectingTasks"]
                  }
                },
                nextSteps: {
                  type: "object",
                  description: "Categorized next steps and recommendations",
                  properties: {
                    userExperience: {
                      type: "array",
                      items: { type: "string" },
                      description: "User experience improvements (e.g., loading states, visual feedback, animations)"
                    },
                    informationArchitecture: {
                      type: "array",
                      items: { type: "string" },
                      description: "Information architecture improvements (e.g., navigation, content organization, labeling)"
                    },
                    accessibility: {
                      type: "array",
                      items: { type: "string" },
                      description: "Accessibility improvements (e.g., keyboard navigation, screen reader support, color contrast)"
                    }
                  },
                  required: ["userExperience", "informationArchitecture", "accessibility"]
                },
                generalFeedback: {
                  type: "string",
                  description: "Overall feedback and summary of the session"
                }
              },
              required: ["taskCompletionPercentage", "findings", "nextSteps", "generalFeedback"]
            }
          }
        }
      ],
      tool_choice: "auto",
    })

    const choice = response.choices[0]
    const toolCalls = choice.message.tool_calls

    if (toolCalls && toolCalls.length > 0) {
      return NextResponse.json({
        action: "tool_call",
        tool_calls: toolCalls,
        message: choice.message,
      })
    }

    return NextResponse.json({
      action: "message",
      content: choice.message.content,
      message: choice.message,
    })
  } catch (error: any) {
    console.error("Agent error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
