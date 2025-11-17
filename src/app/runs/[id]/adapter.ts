import type { RunEvent, PersonaProgress, RunStatus } from "./model"

export interface LiveRunAdapter {
  start: (emit: {
    event: (e: RunEvent) => void
    log: (line: { t: number; text: string }) => void
    persona: (p: Partial<PersonaProgress> & { id: string }) => void
    status: (s: { status: RunStatus }) => void
  }) => { stop: () => void }
}

export class MockLiveRunAdapter implements LiveRunAdapter {
  start(emit: {
    event: (e: RunEvent) => void
    log: (line: { t: number; text: string }) => void
    persona: (p: Partial<PersonaProgress> & { id: string }) => void
    status: (s: { status: RunStatus }) => void
  }) {
    const startTime = Date.now()
    let currentTime = 0
    let stopped = false
    let currentPersonaIndex = 0

    const eventTemplates: Array<{ t: number; event: Omit<RunEvent, "id" | "personaId" | "t"> }> = [
      {
        t: 5,
        event: {
          type: "click",
          label: 'Changed view to "2x4 grid"',
          details: "Grid layout updated from 1x3 to 2x4",
          stepIndex: 0,
        },
      },
      {
        t: 12,
        event: {
          type: "click",
          label: 'Selected "GPT-4" model',
          details: "Model selection successful",
          stepIndex: 0,
        },
      },
      {
        t: 23,
        event: {
          type: "rage",
          label: 'Rage click on "Compare" button',
          details: "Multiple rapid clicks detected on comparison controls",
          stepIndex: 0,
        },
      },
      {
        t: 31,
        event: {
          type: "error",
          label: "Model comparison failed",
          details: "Unable to load comparison data",
          stepIndex: 0,
        },
      },
      {
        t: 38,
        event: {
          type: "backtrack",
          label: "Switched back to 1x3 view",
          details: "User returned to original grid layout",
          stepIndex: 0,
        },
      },
      {
        t: 46,
        event: {
          type: "submit",
          label: 'Saved evaluation with "Claude Sonnet"',
          details: "Evaluation preferences saved successfully",
          stepIndex: 0,
        },
      },
    ]

    const personas = [
      { id: "jenny-novice", name: "Jenny/Novice", duration: 48 },
      { id: "jenny-timepressed", name: "Jenny/Time-pressed", duration: 48 },
      { id: "jenny-keyboard", name: "Jenny/Keyboard-only", duration: 48 },
    ]

    let personaStartTime = 0
    let eventIndex = 0

    // Simulate progress updates
    const interval = setInterval(() => {
      if (stopped) return

      currentTime += 1
      const personaElapsed = currentTime - personaStartTime
      const currentPersona = personas[currentPersonaIndex]

      // Emit events for current persona (within 48 seconds)
      while (eventIndex < eventTemplates.length && eventTemplates[eventIndex].t <= personaElapsed) {
        const { event } = eventTemplates[eventIndex]
        const eventTime = personaElapsed

        emit.event({
          ...event,
          id: `event-${currentPersonaIndex}-${eventIndex}`,
          personaId: currentPersona.id,
          t: eventTime,
        })

        // Emit corresponding log
        emit.log({
          t: eventTime,
          text: `${currentPersona.name} — Step ${(event.stepIndex || 0) + 1}: ${event.label.toLowerCase()}`,
        })

        eventIndex++
      }

      // Update current persona progress
      const percent = Math.min(100, (personaElapsed / currentPersona.duration) * 100)

      emit.persona({
        id: currentPersona.id,
        status: "running",
        percent,
      })

      // Mark other personas based on their state
      personas.forEach((persona, idx) => {
        if (idx < currentPersonaIndex) {
          emit.persona({ id: persona.id, status: "completed", percent: 100 })
        } else if (idx > currentPersonaIndex) {
          emit.persona({ id: persona.id, status: "queued", percent: 0 })
        }
      })

      // Check if current persona is done
      if (personaElapsed >= currentPersona.duration) {
        emit.persona({
          id: currentPersona.id,
          status: "completed",
          percent: 100,
        })

        // Move to next persona
        currentPersonaIndex++

        if (currentPersonaIndex < personas.length) {
          // Reset for next persona
          personaStartTime = currentTime
          eventIndex = 0

          console.log(`[v0] Persona ${currentPersonaIndex} starting, resetting video and log`)
        } else {
          // All personas complete
          emit.status({ status: "completed" })
          clearInterval(interval)
        }
      }
    }, 1000)

    return {
      stop: () => {
        stopped = true
        clearInterval(interval)
      },
    }
  }
}
