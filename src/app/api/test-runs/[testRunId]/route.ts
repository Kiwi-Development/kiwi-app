import { NextRequest, NextResponse } from "next/server";

const TEST_RUNNER_SERVICE_URL = process.env.TEST_RUNNER_SERVICE_URL || "http://localhost:3001";

/**
 * GET /api/test-runs/[testRunId]
 * Fetch test run status
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ testRunId: string }> }) {
  try {
    const { testRunId } = await params;

    const response = await fetch(`${TEST_RUNNER_SERVICE_URL}/api/test-runs/${testRunId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Test run not found" }, { status: 404 });
      }
      const errorText = await response.text();
      console.error("Test runner service error:", errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch test run" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching test run:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
