import { NextRequest } from "next/server";

const TEST_RUNNER_SERVICE_URL = process.env.TEST_RUNNER_SERVICE_URL || "http://localhost:3001";

/**
 * GET /api/test-runs/[testRunId]/stream
 * Proxy SSE stream from test-runner service
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ testRunId: string }> }) {
  try {
    const { testRunId } = await params;

    // Create a readable stream that proxies to the test-runner service
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(
            `${TEST_RUNNER_SERVICE_URL}/api/test-runs/${testRunId}/stream`,
            {
              method: "GET",
              headers: {
                Accept: "text/event-stream",
              },
            }
          );

          if (!response.ok) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Failed to connect to stream" })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Forward the chunk to the client
            controller.enqueue(value);
          }
        } catch (error) {
          console.error("Error in SSE stream:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error", message: String(error) })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error setting up SSE stream:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
