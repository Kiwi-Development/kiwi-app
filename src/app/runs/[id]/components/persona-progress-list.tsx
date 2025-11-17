"use client"

import type { PersonaProgress } from "../model"
import { Progress } from "../../../../../components/ui/progress"

interface PersonaProgressListProps {
  personas: PersonaProgress[]
}

const statusColors: Record<string, string> = {
  queued: "bg-slate-500",
  running: "bg-blue-500",
  completed: "bg-green-500",
}

const statusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
}

export function PersonaProgressList({ personas }: PersonaProgressListProps) {
  return (
    <div className="space-y-4">
      {personas.map((persona) => (
        <div key={persona.id} className="space-y-2" data-testid={`persona-row-${persona.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                {persona.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {persona.name} / {persona.variant}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`h-2 w-2 rounded-full ${statusColors[persona.status]}`} />
                  <span className="text-xs text-muted-foreground">{statusLabels[persona.status]}</span>
                </div>
              </div>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{Math.round(persona.percent)}%</span>
          </div>
          <Progress value={persona.percent} className="h-2" />
        </div>
      ))}
    </div>
  )
}
