import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

interface Step {
  number: number
  title: string
}

const steps: Step[] = [
  { number: 1, title: "Basics" },
  { number: 2, title: "Persona & Use Case" },
  { number: 3, title: "Upload Prototype" },
  { number: 4, title: "Protocol" },
  { number: 5, title: "Review & Run" },
]

interface StepIndicatorProps {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="px-6 py-8 bg-card border-b border-border">
      <ol className="flex items-center justify-between max-w-5xl mx-auto">
        {steps.map((step, stepIdx) => (
          <li key={step.number} className={cn("relative flex-1", stepIdx !== steps.length - 1 ? "pr-8" : "")}>
            <div className="flex items-center">
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                  step.number < currentStep
                    ? "border-primary bg-primary"
                    : step.number === currentStep
                      ? "border-primary bg-background"
                      : "border-border bg-background",
                )}
              >
                {step.number < currentStep ? (
                  <Check className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      step.number === currentStep ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {step.number}
                  </span>
                )}
              </div>
              {stepIdx !== steps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-10 -ml-px h-0.5 w-full transition-colors",
                    step.number < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className="mt-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  step.number <= currentStep ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
