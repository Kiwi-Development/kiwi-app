"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { AppLayout } from "../../../../components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import { Share2 } from "lucide-react"
import { ReplayPlayer } from "./components/replay-player"
import { PersonaProgressList } from "./components/persona-progress-list"
import { LiveLog } from "./components/live-log"
import { EventTimeline } from "./components/event-timeline"
import { SideTabs } from "./components/side-tabs"
import type { LiveRunState, RunEvent } from "./model"
import { MockLiveRunAdapter } from "./adapter"
import { useToast } from "../../../../hooks/use-toast"
import { testStore } from "../../../../lib/test-store"

const statusColors: Record<string, string> = {
  queued: "bg-slate-500 text-slate-50",
  running: "bg-blue-500 text-blue-50",
  completed: "bg-green-500 text-green-50",
  "needs-validation": "bg-amber-500 text-amber-50",
  error: "bg-red-500 text-red-50",
}

const statusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  "needs-validation": "Needs Validation",
  error: "Error",
}

export default function LiveRunPage() {
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string>()
  const [videoKey, setVideoKey] = useState(0)

  const testId = params.id as string

  const [state, setState] = useState<LiveRunState>({
    runId: testId,
    title: "Onboarding A/B — Storefront",
    status: "running",
    startedAt: Date.now(),
    etaLabel: "~8 min",
    personas: [
      { id: "jenny-novice", name: "Jenny", variant: "Novice", status: "queued", percent: 0 },
      { id: "jenny-timepressed", name: "Jenny", variant: "Time-pressed", status: "queued", percent: 0 },
      { id: "jenny-keyboard", name: "Jenny", variant: "Keyboard-only", status: "queued", percent: 0 },
    ],
    events: [],
    logs: [],
    steps: [
      { index: 0, title: 'Create a new storefront, choose "Apparel", land on dashboard' },
      { index: 1, title: 'Add product "Linen Button-Down" priced $68' },
    ],
    tags: [
      { id: "tag-1", t: 78, tag: "Success Step" },
      { id: "tag-2", t: 52, tag: "Error State" },
      { id: "tag-3", t: 108, tag: "Copy Risk" },
    ],
    consoleTrace: [],
  })

  const prevCompletedCountRef = useRef(0)

  useEffect(() => {
    const test = testStore.getTestById(testId)
    if (test) {
      setState((prev) => ({
        ...prev,
        title: test.title,
        status: test.status === "completed" ? "completed" : "running",
      }))

      if (test.status === "completed") {
        router.push(`/reports/${testId}`)
      }
    }
  }, [testId, router])

  useEffect(() => {
    const adapter = new MockLiveRunAdapter()

    const emitHandlers = {
      event: (e: RunEvent) => {
        setState((prev) => ({
          ...prev,
          events: [...prev.events, e].sort((a, b) => a.t - b.t),
          consoleTrace: [
            ...prev.consoleTrace,
            {
              action: e.type,
              label: e.label,
              timestamp: e.t,
              personaId: e.personaId,
            },
          ],
        }))
      },
      log: (line: { t: number; text: string }) => {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, line],
        }))
      },
      persona: (p: any) => {
        setState((prev) => {
          const updatedPersonas = prev.personas.map((persona) => (persona.id === p.id ? { ...persona, ...p } : persona))

          const completedCount = updatedPersonas.filter((p) => p.status === "completed").length
          const totalCount = updatedPersonas.length

          let etaLabel = "~8 min"
          if (completedCount === 1) {
            etaLabel = "~5 min"
          } else if (completedCount === 2) {
            etaLabel = "~2 min"
          } else if (completedCount === 3) {
            etaLabel = "0 min"
          }

          testStore.updateTestProgress(testId, completedCount, totalCount)

          if (completedCount > prevCompletedCountRef.current && completedCount < totalCount) {
            console.log(`[v0] Persona ${completedCount} completed, resetting video and clearing logs`)

            setVideoKey((prev) => prev + 1)

            prevCompletedCountRef.current = completedCount

            return {
              ...prev,
              personas: updatedPersonas,
              etaLabel,
              logs: [],
              events: [],
            }
          }

          prevCompletedCountRef.current = completedCount

          return {
            ...prev,
            personas: updatedPersonas,
            etaLabel,
          }
        })
      },
      status: (s: { status: any }) => {
        setState((prev) => ({
          ...prev,
          status: s.status,
        }))

        if (s.status === "completed") {
          setTimeout(() => {
            router.push(`/reports/${testId}`)
          }, 2000)
        }
      },
    }

    const control = adapter.start(emitHandlers)

    return () => {
      control.stop()
    }
  }, [testId, router])

  const handleEventClick = (event: RunEvent) => {
    if (videoRef.current) {
      videoRef.current.currentTime = event.t
    }
    setHighlightedEventId(event.id)
    setTimeout(() => setHighlightedEventId(undefined), 2000)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({
      title: "Link copied",
      description: "Run link copied to clipboard",
    })
  }

  const videoUrl = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/test_video-UOVNF3qfZLAN4grybvKaejGMEHvvPG.mp4"

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>

      <main className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{state.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={statusColors[state.status]} data-testid="run-status-chip">
                  {statusLabels[state.status]}
                </Badge>
                {state.etaLabel && <span className="text-sm text-muted-foreground">{state.etaLabel} remaining</span>}
              </div>
            </div>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Persona Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <PersonaProgressList personas={state.personas} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Live Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <LiveLog logs={state.logs} startTime={state.startedAt} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <EventTimeline
                    events={state.events}
                    onEventClick={handleEventClick}
                    highlightedEventId={highlightedEventId}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Replay</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReplayPlayer
                      key={videoKey}
                      videoUrl={videoUrl}
                      events={state.events}
                      initialTime={Number.parseInt(searchParams.get("t") || "0", 10)}
                      ref={videoRef}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <SideTabs
                steps={state.steps}
                tags={state.tags}
                consoleTrace={state.consoleTrace}
                onTagClick={(time) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = time
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
    </div>
  )
}
