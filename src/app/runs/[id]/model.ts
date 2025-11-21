export type RunStatus = "queued" | "running" | "completed" | "needs-validation" | "error"

export type RunEventType = "click" | "submit" | "backtrack" | "error" | "rage" | "copy-risk" | "focus-trap"

export type RunEvent = {
  id: string
  t: number // seconds into the replay
  type: RunEventType
  label: string // short, human-readable summary
  details?: string // optional extra info
  personaId?: string
  stepIndex?: number // task step index
}

export type PersonaProgress = {
  id: string
  name: string // e.g., "Jenny"
  variant: string // e.g., "Novice"
  status: "queued" | "running" | "completed" | "error"
  percent: number // 0–100
}

export type LiveRunState = {
  runId: string
  title: string
  status: RunStatus
  startedAt?: number // epoch ms
  etaLabel?: string // e.g., "~8 min"
  duration?: number // seconds (use video duration when known)
  personas: PersonaProgress[]
  events: RunEvent[] // append-only, sorted by `t`
  logs: { t: number; text: string }[] // append-only
  steps: { index: number; title: string; pass?: boolean; duration?: number }[]
  tags: { id: string; t: number; tag: string }[] // e.g., Success Step, Error State
  consoleTrace: unknown[] // raw JSON chunks to render
}
