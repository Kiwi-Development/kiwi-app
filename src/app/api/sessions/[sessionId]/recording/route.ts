import { NextRequest, NextResponse } from "next/server";

const TEST_RUNNER_SERVICE_URL = process.env.TEST_RUNNER_SERVICE_URL || "http://localhost:3001";

/**
 * GET /api/sessions/[sessionId]/recording
 * Fetch recording events for a Browserbase session using rrweb
 * Proxies through test-runner service which has Browserbase SDK configured
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Proxy through test-runner service
    const response = await fetch(
      `${TEST_RUNNER_SERVICE_URL}/api/sessions/${sessionId}/recording`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { 
            error: errorData.error || "Recording not available. Recordings are available about 30 seconds after session close." 
          },
          { status: 404 }
        );
      }

      const errorText = await response.text();
      console.error("Test runner service error:", errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch recording events" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recording events:", error);
    
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    return NextResponse.json(
      { 
        error: "Failed to fetch recording events",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

