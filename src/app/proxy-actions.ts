"use server";

// Helper function to get BASE_URL (called at runtime, not module load time)
function getBaseUrl(): string {
  const host = process.env.NEXT_PUBLIC_EC2_IP || "localhost";
  const isLocalhost = !host || host === "localhost" || host.startsWith("127.0.0.1");

  console.log(`[Proxy] getBaseUrl - host: ${host}, isLocalhost: ${isLocalhost}`);

  if (isLocalhost) {
    // Local development: http://localhost:5001
    const port = process.env.NEXT_PUBLIC_BACKEND_PORT || "5001";
    const url = `http://${host}:${port}`;
    console.log(`[Proxy] Using localhost URL: ${url}`);
    return url;
  } else {
    // Production (Render): https://kiwi-backend.onrender.com (no port needed)
    // Ensure host doesn't already have https://
    const cleanHost = host.replace(/^https?:\/\//, "");
    const url = `https://${cleanHost}`;
    console.log(`[Proxy] Using production URL: ${url}`);
    return url;
  }
}

export async function startSession(url: string, retryCount = 0): Promise<any> {
  console.log(`[Proxy] startSession called with url: ${url}, retryCount: ${retryCount}`);

  try {
    // Validate environment variables early
    const host = process.env.NEXT_PUBLIC_EC2_IP;
    if (!host || host.trim() === "") {
      const errorMsg =
        "NEXT_PUBLIC_EC2_IP environment variable is not set. Please configure it in Vercel.";
      console.error(`[Proxy] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const BASE_URL = getBaseUrl();
    const backendUrl = `${BASE_URL}/start`;
    const maxRetries = 1; // Retry once for cold start

    console.log(
      `[Proxy] Starting session (attempt ${retryCount + 1}/${maxRetries + 1}) - Backend URL: ${backendUrl}, Target Figma URL: ${url}`
    );
    console.log(
      `[Proxy] Environment variables - NEXT_PUBLIC_EC2_IP: ${host || "NOT SET"}, NEXT_PUBLIC_BACKEND_PORT: ${process.env.NEXT_PUBLIC_BACKEND_PORT || "NOT SET"}`
    );
    console.log(`[Proxy] Computed BASE_URL: ${BASE_URL}`);

    const controller = new AbortController();
    // Timeout: 180 seconds (increased to handle browser installation and slow navigation)
    // Playwright operations (browser launch, page navigation) can take time, especially on first run
    const timeout = 180000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        const errorMessage = `Backend request failed: ${res.status} ${res.statusText}. URL: ${backendUrl}. Response: ${text}`;
        console.error(`[Proxy] ${errorMessage}`);

        // Retry on 5xx errors (might be cold start issue)
        if (res.status >= 500 && retryCount < maxRetries) {
          console.log(`[Proxy] Retrying after server error (cold start?)...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return startSession(url, retryCount + 1);
        }

        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log(`[Proxy] Session started successfully: ${data.sessionId}`);
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        // Retry on timeout (transient network issues)
        if (retryCount < maxRetries) {
          console.log(`[Proxy] Request timed out, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return startSession(url, retryCount + 1);
        }
        const errorMsg = `Request to backend timed out after ${timeout / 1000} seconds. URL: ${backendUrl}`;
        console.error(`[Proxy] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Retry on network errors (transient connectivity issues)
      if (retryCount < maxRetries && fetchError instanceof Error) {
        const isNetworkError =
          fetchError.message.includes("fetch failed") ||
          fetchError.message.includes("network") ||
          fetchError.message.includes("ECONNREFUSED");

        if (isNetworkError) {
          console.log(`[Proxy] Network error, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return startSession(url, retryCount + 1);
        }
      }

      console.error(`[Proxy] Fetch error:`, fetchError);
      throw fetchError;
    }
  } catch (error) {
    // Provide more detailed error information
    const BASE_URL = getBaseUrl();

    // Extract error message safely (ensure it's serializable)
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message || "Unknown error";
      // Log full error details for debugging (not in the thrown error)
      console.error(`[Proxy] startSession error caught in outer catch:`, error);
      console.error(`[Proxy] Error type: ${error.constructor.name}`);
      console.error(`[Proxy] Error message: ${errorMessage}`);
      if (error.stack) {
        console.error(`[Proxy] Error stack:`, error.stack);
      }
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      errorMessage = "Unknown error occurred";
      console.error(`[Proxy] startSession error (non-Error type):`, error);
    }

    // Log the constructed message
    const finalMessage = `Failed to connect to backend at ${BASE_URL}: ${errorMessage}`;
    console.error(`[Proxy] Throwing error: ${finalMessage}`);

    // Throw a simple Error with a plain string message (serializable)
    throw new Error(finalMessage);
  }
}

export async function proxyClick(sessionId: string, x: number, y: number) {
  const BASE_URL = getBaseUrl();
  console.log(`[Proxy] Clicking at ${x},${y} for session ${sessionId}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(`${BASE_URL}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, x, y }),
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to click: ${res.status}`);
      }

      return await res.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error(`Click request timed out after 30 seconds`);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("[Proxy] Click error:", error);
    const message = error instanceof Error ? error.message : "Failed to click";
    throw new Error(message);
  }
}

export async function proxyScreenshot(sessionId: string) {
  const BASE_URL = getBaseUrl();
  try {
    // console.log(`[Proxy] Fetching screenshot for session ${sessionId}`)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(`${BASE_URL}/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        // Handle 410 Gone (session not found) specially
        if (res.status === 410) {
          return {
            status: "error",
            message: errorData.detail?.message || `Session ${sessionId} not found or closed`,
            code: "SESSION_NOT_FOUND",
          };
        }

        // Handle 504 Gateway Timeout (screenshot timeout)
        if (res.status === 504) {
          return {
            status: "error",
            message:
              errorData.detail?.message || "Screenshot timeout - page is taking too long to render",
            code: "SCREENSHOT_TIMEOUT",
          };
        }

        // If 404 or other error, return error status but don't throw to avoid crashing loop
        return {
          status: "error",
          message: `Failed to get screenshot: ${res.status}`,
        };
      }

      const data = await res.json();
      return { status: "ok", screenshot: data.screenshot };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return {
          status: "error",
          message: "Screenshot request timed out after 30 seconds",
        };
      }
      throw fetchError;
    }
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
  const BASE_URL = getBaseUrl();
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
  const BASE_URL = getBaseUrl();
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
