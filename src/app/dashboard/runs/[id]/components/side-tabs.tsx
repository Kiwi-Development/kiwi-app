"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs"
import { Badge } from "../../../../../components/ui/badge"
import { CheckCircle2, XCircle } from "lucide-react"

interface Step {
  index: number
  title: string
  pass?: boolean
  duration?: number
}

interface Tag {
  id: string
  t: number
  tag: string
}

interface SideTabsProps {
  steps: Step[]
  tags: Tag[]
  consoleTrace: unknown[]
  onTagClick?: (time: number) => void
}

export function SideTabs({ steps, tags, consoleTrace, onTagClick }: SideTabsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Tabs defaultValue="steps" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="steps" className="flex-1">
          Steps
        </TabsTrigger>
        <TabsTrigger value="tags" className="flex-1">
          Tags
        </TabsTrigger>
        <TabsTrigger value="console" className="flex-1">
          Console
        </TabsTrigger>
      </TabsList>

      <TabsContent value="steps" className="space-y-3 mt-4">
        {steps.map((step) => (
          <div key={step.index} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{step.title}</h4>
              {step.pass !== undefined && (
                <Badge variant={step.pass ? "default" : "destructive"} className="flex items-center gap-1">
                  {step.pass ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Pass
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Fail
                    </>
                  )}
                </Badge>
              )}
            </div>
            {step.duration !== undefined && (
              <p className="text-sm text-muted-foreground">Duration: {formatTime(step.duration)}</p>
            )}
          </div>
        ))}
      </TabsContent>

      <TabsContent value="tags" className="space-y-2 mt-4">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tagged events will appear here during the run</p>
        ) : (
          tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onTagClick?.(tag.t)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm">{tag.tag}</span>
              <span className="text-xs font-mono text-muted-foreground">{formatTime(tag.t)}</span>
            </button>
          ))
        )}
      </TabsContent>

      <TabsContent value="console" className="mt-4">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {consoleTrace.length === 0 ? (
            <p className="text-sm text-muted-foreground">Console trace will appear here during the run</p>
          ) : (
            consoleTrace.map((trace, index) => (
              <pre key={index} className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(trace, null, 2)}
              </pre>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
