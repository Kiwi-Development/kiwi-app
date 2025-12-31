"use server";

// Determine protocol and URL format based on environment
// Local development uses http with port, production (Render) uses https without port
const host = process.env.NEXT_PUBLIC_EC2_IP || "localhost";
const isLocalhost = !host || host === "localhost" || host.startsWith("127.0.0.1");

let BASE_URL: string;
if (isLocalhost) {
  // Local development: http://localhost:5001
  const port = process.env.NEXT_PUBLIC_BACKEND_PORT || "5001";
  BASE_URL = `http://${host}:${port}`;
} else {
  // Production (Render): https://kiwi-backend.onrender.com (no port needed)
  BASE_URL = `https://${host}`;
}

// Debug: Log the backend URL being used
if (typeof window === "undefined") {
  console.log(`[Proxy] Backend URL configured: ${BASE_URL}`);
}

export async function startSession(url: string) {
  try {
    const backendUrl = `${BASE_URL}/start`;
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      const errorMessage = `Backend request failed: ${res.status} ${res.statusText}. URL: ${backendUrl}. Response: ${text}`;
      throw new Error(errorMessage);
    }

    return await res.json();
  } catch (error) {
    // Provide more detailed error information
    const errorMessage =
      error instanceof Error
        ? `Failed to connect to backend at ${BASE_URL}: ${error.message}`
        : `Failed to connect to backend at ${BASE_URL}: Unknown error`;
    throw new Error(errorMessage);
  }
}

export async function proxyClick(sessionId: string, x: number, y: number) {
  console.log(`[Proxy] Clicking at ${x},${y} for session ${sessionId}`);
  try {
    const res = await fetch(`${BASE_URL}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, x, y }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to click: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("[Proxy] Click error:", error);
    const message = error instanceof Error ? error.message : "Failed to click";
    throw new Error(message);
  }
}

export async function proxyScreenshot(sessionId: string) {
  try {
    // console.log(`[Proxy] Fetching screenshot for session ${sessionId}`)
    const res = await fetch(`${BASE_URL}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    });

    if (!res.ok) {
      // If 404 or other error, return error status but don't throw to avoid crashing loop
      return {
        status: "error",
        message: `Failed to get screenshot: ${res.status}`,
      };
    }

    const data = await res.json();
    return { status: "ok", screenshot: data.screenshot };
  } catch (error) {
    console.error("[Proxy] Screenshot error:", error);
    const message = error instanceof Error ? error.message : "Failed to get screenshot";
    return {
      status: "error",
      message,
    };
  }
}

export async function extractContext(sessionId: string) {
  try {
    const res = await fetch(`${BASE_URL}/extract-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `Failed to extract context: ${res.status}`,
        context: null,
      };
    }

    const data = await res.json();
    return {
      status: "ok",
      context: data.context || null,
    };
  } catch (error) {
    console.error("[Proxy] Extract context error:", error);
    const message = error instanceof Error ? error.message : "Failed to extract context";
    return {
      status: "error",
      message,
      context: null,
    };
  }
}

export async function fetchFigmaMetadata(url: string, apiToken?: string) {
  try {
    const res = await fetch(`${BASE_URL}/figma-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, apiToken }),
      cache: "no-store",
    });

    if (!res.ok) {
      // For public files, this is not an error - we'll use DOM/A11y extraction instead
      return {
        status: "ok",
        metadata: {
          public: true,
          metadata_available: false,
          note: "Figma API token not available. Using DOM/A11y extraction instead.",
        },
        enhanced: false,
      };
    }

    const data = await res.json();
    return {
      status: "ok",
      metadata: data.metadata || null,
      enhanced: data.enhanced || false,
    };
  } catch (error) {
    // For public files, this is not a critical error - we'll use DOM/A11y extraction instead
    console.log("[Proxy] Figma metadata not available, using DOM/A11y extraction instead");
    return {
      status: "ok",
      metadata: {
        public: true,
        metadata_available: false,
        note: "Figma metadata unavailable. Using DOM/A11y extraction instead.",
      },
      enhanced: false,
    };
  }
}
