import { OpenAI } from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { screenshot, tasks, history } = await req.json()

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot is required" }, { status: 400 })
    }

    const systemPrompt = `You are a helpful assistant that will simulate UI/UX usability testing. You will be given two functions that link to a Flask API endpoint for clicking and receiving a screenshot of the screen. Using those two tools, you will attempt to complete the tasks given to you by navigating the Figma UI via those two endpoints. Your goal is to complete the following tasks on the provided UI:
      ${tasks.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

      Analyze the screenshot and decide the next action.
      - If you see an element that helps complete the current task, click it.
      - If you are unsure, you can click to explore or wait.
      - If the task is complete, move to the next one.

      NOTE: Never click on "Continue with Google" or any other element outside the prototype screen.
      You should only be clicking within the device boundaries.

      You have access to a 'click' tool. Use it to interact with the interface.
      The screenshot is the current state of the browser.`

    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history,
      {
        role: "user",
        content: [
          { type: "text", text: "Here is the current screen. What should I do next?" },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${screenshot}`,
            },
          },
        ],
      },
    ]

    console.log("[OpenAI] Making API call to gpt-4o with", messages.length, "messages")
    
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
