import { NextRequest, NextResponse } from "next/server";

const TEST_RUNNER_SERVICE_URL = process.env.TEST_RUNNER_SERVICE_URL || "http://localhost:3001";

/**
 * POST /api/test-runs
 * Start a new test run
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate testId is present
    if (!body.testId) {
      console.error("Missing testId in request body:", body);
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    console.log("Creating test run for testId:", body.testId);

    const response = await fetch(`${TEST_RUNNER_SERVICE_URL}/api/test-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Test runner service error:", errorText);
      return NextResponse.json(
        { error: errorText || "Failed to start test run" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error starting test run:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/test-runs?testId=xxx&limit=1
 * Get test runs for a specific test
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get("testId");
    const limit = searchParams.get("limit");

    if (!testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    const url = new URL(`${TEST_RUNNER_SERVICE_URL}/api/test-runs`);
    url.searchParams.set("testId", testId);
    if (limit) {
      url.searchParams.set("limit", limit);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Test runner service error:", errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch test runs" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching test runs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
