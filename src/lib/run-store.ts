import { LiveRunState } from "./types"

type ActiveRun = {
  testId: string
  sessionId: string
  state: LiveRunState
  agentHistory: any[]
  lastUpdated: number
}

class RunStore {
  private storageKey = "kiwi_active_runs"

  getActiveRun(testId: string): ActiveRun | undefined {
    if (typeof window === "undefined") return undefined
    const stored = localStorage.getItem(this.storageKey)
    if (!stored) return undefined
    
    const runs: Record<string, ActiveRun> = JSON.parse(stored)
    const run = runs[testId]
    
    // Optional: Expire runs older than X hours?
    // For now, let's keep them until explicitly cleared or overwritten.
    return run
  }

  saveRun(testId: string, data: Omit<ActiveRun, "lastUpdated">) {
    if (typeof window === "undefined") return
    
    const stored = localStorage.getItem(this.storageKey)
    const runs: Record<string, ActiveRun> = stored ? JSON.parse(stored) : {}
    
    runs[testId] = {
      ...data,
      lastUpdated: Date.now(),
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(runs))
  }

  clearRun(testId: string) {
    if (typeof window === "undefined") return
    
    const stored = localStorage.getItem(this.storageKey)
    if (!stored) return
    
    const runs: Record<string, ActiveRun> = JSON.parse(stored)
    delete runs[testId]
    
    localStorage.setItem(this.storageKey, JSON.stringify(runs))
  }
}

export const runStore = new RunStore()
