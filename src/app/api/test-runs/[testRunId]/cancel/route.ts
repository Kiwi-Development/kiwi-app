import { NextRequest, NextResponse } from "next/server";

const TEST_RUNNER_SERVICE_URL = process.env.TEST_RUNNER_SERVICE_URL || "http://localhost:3001";

/**
 * POST /api/test-runs/[testRunId]/cancel
 * Cancel a running test run
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ testRunId: string }> }) {
  try {
    const { testRunId } = await params;

    const response = await fetch(`${TEST_RUNNER_SERVICE_URL}/api/test-runs/${testRunId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Test runner service error:", errorText);
      return NextResponse.json(
        { error: errorText || "Failed to cancel test run" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error canceling test run:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
