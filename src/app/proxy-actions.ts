"use server"

const EC2_IP = process.env.NEXT_PUBLIC_EC2_IP || "3.87.252.149"
const BASE_URL = `http://${EC2_IP}`

export async function startSession(url: string) {
  console.log(`[Proxy] Starting session for URL: ${url} at ${BASE_URL}`)
  try {
    const res = await fetch(`${BASE_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to start session: ${res.status} ${text}`)
    }

    return await res.json()
  } catch (error: any) {
    console.error("[Proxy] Start session error:", error)
    throw new Error(error.message || "Failed to start session")
  }
}

export async function proxyClick(sessionId: string, x: number, y: number) {
  console.log(`[Proxy] Clicking at ${x},${y} for session ${sessionId}`)
  try {
    const res = await fetch(`${BASE_URL}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, x, y }),
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to click: ${res.status}`)
    }

    return await res.json()
  } catch (error: any) {
    console.error("[Proxy] Click error:", error)
    throw new Error(error.message || "Failed to click")
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
    })

    if (!res.ok) {
      // If 404 or other error, return error status but don't throw to avoid crashing loop
      return { status: "error", message: `Failed to get screenshot: ${res.status}` }
    }

    const data = await res.json()
    return { status: "ok", screenshot: data.screenshot }
  } catch (error: any) {
    console.error("[Proxy] Screenshot error:", error)
    return { status: "error", message: error.message || "Failed to get screenshot" }
  }
}
