"use server"

export async function proxyScreenshot(serverUrl: string) {
  try {
    const res = await fetch(`${serverUrl}/screenshot`, {
      method: "POST",
      cache: "no-store",
    })
    
    if (!res.ok) {
      return { status: "error", message: `Backend returned ${res.status}` }
    }
    
    return await res.json()
  } catch (error: any) {
    console.error("Proxy screenshot error:", error)
    return { status: "error", message: error.message }
  }
}

export async function proxyClick(serverUrl: string, x: number, y: number) {
  try {
    const res = await fetch(`${serverUrl}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
      cache: "no-store",
    })

    if (!res.ok) {
      return { status: "error", message: `Backend returned ${res.status}` }
    }

    return await res.json()
  } catch (error: any) {
    console.error("Proxy click error:", error)
    return { status: "error", message: error.message }
  }
}
