"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { AppLayout } from "../../../../components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import { Share2 } from "lucide-react"
import { PersonaProgressList } from "./components/persona-progress-list"
import { LiveLog } from "./components/live-log"
import { EventTimeline } from "./components/event-timeline"
import { SideTabs } from "./components/side-tabs"
import type { LiveRunState, RunEvent } from "@/lib/types"
import { useToast } from "../../../../hooks/use-toast"
import { testStore } from "../../../../lib/test-store"
import { personaStore } from "../../../../lib/persona-store"
import { runStore } from "@/lib/run-store"
import { proxyScreenshot, proxyClick } from "../../proxy-actions"

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
  const [isSimulating, setIsSimulating] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null)
  const [agentHistory, setAgentHistory] = useState<any[]>([])
  const simulationRef = useRef(false)

  const testId = params.id as string

  // Initialize state with actual test data or from active run
  const [state, setState] = useState<LiveRunState>(() => {
    const activeRun = runStore.getActiveRun(testId)
    
    if (activeRun && activeRun.state.status === "running") {
      return activeRun.state
    }
    
    // Initialize from test data
    const test = testStore.getTestById(testId)
    if (test) {
      const personas = test.testData?.selectedPersona ? (() => {
        const p = personaStore.getPersonas().find((persona) => persona.id === test.testData?.selectedPersona)
        return p ? [{
          id: test.testData.selectedPersona,
          name: p.name,
          variant: p.role,
          status: "queued" as const,
          percent: 0,
        }] : []
      })() : []

      const steps = test.testData?.tasks?.map((task, index) => ({
        index,
        title: task,
      })) || []

      return {
        runId: testId,
        title: test.title,
        status: test.status === "completed" ? "completed" : "running",
        startedAt: Date.now(),
        etaLabel: "~8 min",
        personas,
        events: [],
        logs: [],
        steps,
        tags: [],
        consoleTrace: [],
      }
    }
    
    // Fallback to loading state
    return {
      runId: testId,
      title: "Loading...",
      status: "running",
      startedAt: Date.now(),
      etaLabel: "~8 min",
      personas: [],
      events: [],
      logs: [],
      steps: [],
      tags: [],
      consoleTrace: [],
    }
  })

  const prevCompletedCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const agentHistoryRef = useRef<any[]>([])
  const startedAtRef = useRef<number>(Date.now())

  // Load initial state from store or create new
  useEffect(() => {
    const activeRun = runStore.getActiveRun(testId)
    
    if (activeRun && activeRun.state.status === "running") {
      console.log("Resuming active run:", activeRun)
      setState(activeRun.state)
      setAgentHistory(activeRun.agentHistory)
      agentHistoryRef.current = activeRun.agentHistory
      sessionIdRef.current = activeRun.sessionId
      if (activeRun.state.startedAt) {
        startedAtRef.current = activeRun.state.startedAt
      }
      
      // If it was running, resume the loop
      if (!simulationRef.current) {
        simulationRef.current = true
        setIsSimulating(true)
        // Resume with correct progress
        const initialProgress = activeRun.state.personas[0]?.percent || 0
        runSimulation(true, initialProgress)
      }
    } else {
      // Check if test is already completed
      const test = testStore.getTestById(testId)
      if (test?.status === "completed") {
        router.push(`/reports/${testId}`)
      }
    }
    
    // Cleanup on unmount
    return () => {
      simulationRef.current = false
    }
  }, [testId, router])

  // Save state changes to store
  useEffect(() => {
    if (state.status === "running" && sessionIdRef.current) {
      runStore.saveRun(testId, {
        testId,
        sessionId: sessionIdRef.current,
        state,
        agentHistory: agentHistoryRef.current,
      })
    } else if (state.status === "completed" || state.status === "error") {
       // Optional: clear run when completed? 
       // runStore.clearRun(testId)
       // For now, let's keep it so they can see the final state if they navigate back
       if (sessionIdRef.current) {
         runStore.saveRun(testId, {
            testId,
            sessionId: sessionIdRef.current,
            state,
            agentHistory: agentHistoryRef.current,
         })
       }
    }
  }, [state, testId]) // Removed agentHistory from deps as we use ref


  const runSimulation = async (isResuming = false, initialProgress = 0) => {
    if (!isResuming && simulationRef.current) return
    // If resuming, we already set simulationRef.current = true in useEffect
    if (!isResuming) {
        simulationRef.current = true
        setIsSimulating(true)
    }

    const test = testStore.getTestById(testId)
    const tasks = test?.testData?.tasks || []
    const figmaUrl = test?.testData?.figmaUrlA || test?.testData?.liveUrl
    
    if (!figmaUrl) {
      toast({
        title: "Configuration Error",
        description: "No Figma URL found for this test.",
        variant: "destructive",
      })
      simulationRef.current = false
      setIsSimulating(false)
      return
    }
    
    let serverUrl: string
    let sessionId: string
    
    // Use static EC2 instance
    try {
      const ip = process.env.NEXT_PUBLIC_EC2_IP
      if (!ip) {
        throw new Error("NEXT_PUBLIC_EC2_IP not configured")
      }
      serverUrl = `https://${ip}`

      if (!isResuming) {
        // Set persona to running
        setState(prev => ({
            ...prev,
            personas: prev.personas.map((p, idx) => 
            idx === 0 ? { ...p, status: "running" as const, percent: 0 } : p
            )
        }))

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, { 
            t: Date.now(), 
            text: `Connecting to server...` 
            }]
        }))
        
        // Start session on backend
        const startRes = await fetch(`${serverUrl}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: figmaUrl })
        })
        
        if (!startRes.ok) {
            throw new Error(`Failed to start session: ${startRes.statusText}`)
        }
        
        const startData = await startRes.json()
        sessionId = startData.sessionId
        sessionIdRef.current = sessionId

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, { 
            t: Date.now(), 
            text: `Browser session started` 
            }]
        }))

        // Wait for server to be ready
        setState(prev => ({
            ...prev,
            logs: [...prev.logs, { t: Date.now(), text: "Waiting for server to be ready..." }]
        }))

        let serverReady = false
        const maxHealthChecks = 50
        
        for (let i = 0; i < maxHealthChecks; i++) {
            await new Promise(r => setTimeout(r, 2000))
            
            try {
            const healthCheck = await proxyScreenshot(serverUrl, sessionId)
            
            if (healthCheck.status === "ok") {
                serverReady = true
                console.log("Server is ready!")
                break
            }
            } catch (e) {
            console.log(`Server not ready yet (attempt ${i + 1}/${maxHealthChecks})`)
            }
        }
        
        if (!serverReady) {
            throw new Error("Server failed to become ready within timeout")
        }

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, { t: Date.now(), text: "✅ Server ready! Starting AI simulation..." }]
        }))
      } else {
          // Resuming
          if (!sessionIdRef.current) {
              throw new Error("Cannot resume without session ID")
          }
          sessionId = sessionIdRef.current
          
          setState(prev => ({
            ...prev,
            logs: [...prev.logs, { t: Date.now(), text: "🔄 Resuming simulation..." }]
          }))
      }

    } catch (error: any) {
      console.error("Failed to start ECS task:", error)
      
      toast({
        title: "Server Start Failed",
        description: error.message,
        variant: "destructive",
      })
      
      setState(prev => ({
        ...prev,
        status: "error",
        personas: prev.personas.map((p, idx) => 
          idx === 0 ? { ...p, status: "error" as const } : p
        ),
        logs: [...prev.logs, { t: Date.now(), text: `❌ ERROR: ${error.message}` }]
      }))
      
      simulationRef.current = false
      setIsSimulating(false)
      return
    }

    // Start progress tracking
    let currentProgress = initialProgress
    const progressIncrement = 2
    
    const progressInterval = setInterval(() => {
      if (!simulationRef.current) {
          clearInterval(progressInterval)
          return
      }

      currentProgress = Math.min(currentProgress + progressIncrement, 100)
      
      setState(prev => ({
        ...prev,
        personas: prev.personas.map((p, idx) => 
          idx === 0 ? { ...p, percent: currentProgress } : p
        )
      }))
      
      if (currentProgress >= 100) {
        clearInterval(progressInterval)
        
        setState(prev => ({
          ...prev,
          status: "completed",
          personas: prev.personas.map((p, idx) => 
            idx === 0 ? { ...p, status: "completed" as const, percent: 100 } : p
          )
        }))
        
        const test = testStore.getTestById(testId)
        if (test) {
          test.status = "completed"
          testStore.saveTest(test)
        }
        
        // Clear active run when completed
        runStore.clearRun(testId)

        setTimeout(() => {
          router.push(`/reports/${testId}`)
        }, 2000)
        
        simulationRef.current = false
      }
    }, 3000)

    // Main simulation loop
    try {
      while (simulationRef.current && currentProgress < 100) {
        const screenshotData = await proxyScreenshot(serverUrl, sessionId)
        
        if (screenshotData.status === "error" || !screenshotData.screenshot) {
          console.error("Failed to get screenshot:", screenshotData.message)
          await new Promise(r => setTimeout(r, 2000))
          continue
        }

        const b64 = screenshotData.screenshot
        setCurrentScreenshot(b64)

        const decideRes = await fetch(`/runs/${testId}/api`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshot: b64,
            tasks,
            history: agentHistoryRef.current,
          }),
        })

        const decision = await decideRes.json()
        console.log("Agent decided:", decision)

        if (decision.action === "tool_call") {
          for (const toolCall of decision.tool_calls) {
            if (toolCall.function.name === "click") {
              const args = JSON.parse(toolCall.function.arguments)
              console.log("Agent clicking:", args)
              
              const event: RunEvent = {
                id: Date.now().toString(),
                t: Date.now() - startedAtRef.current,
                type: "click",
                label: args.rationale || `Click at ${args.x}, ${args.y}`,
                personaId: state.personas[0]?.id || "unknown",
              }
              
              setState(prev => ({
                ...prev,
                events: [...prev.events, event],
                logs: [...prev.logs, { t: Date.now(), text: `Agent: ${args.rationale}` }]
              }))

              await proxyClick(serverUrl, sessionId, args.x, args.y)
            }
          }
          
          const newHistory = [
            ...agentHistoryRef.current,
            decision.message,
            {
              role: "tool",
              tool_call_id: decision.tool_calls[0].id,
              content: "Clicked successfully",
            }
          ]
          agentHistoryRef.current = newHistory
          setAgentHistory(newHistory)

        } else {
          console.log("Agent message:", decision.content)
          setState(prev => ({
            ...prev,
            logs: [...prev.logs, { t: Date.now(), text: `Agent: ${decision.content}` }]
          }))
          
          const newHistory = [...agentHistoryRef.current, decision.message]
          agentHistoryRef.current = newHistory
          setAgentHistory(newHistory)
        }

        await new Promise(r => setTimeout(r, 2000))
      }
    } catch (e) {
      console.error("Simulation error:", e)
      clearInterval(progressInterval)
      toast({
        title: "Simulation Error",
        description: "An error occurred during the simulation.",
        variant: "destructive",
      })
    } finally {
      clearInterval(progressInterval)
      simulationRef.current = false
      setIsSimulating(false)
    }
  }
  
  const hasStartedRef = useRef(false)
  
  useEffect(() => {
    // Only start automatically if NOT resuming (resuming is handled in the first useEffect)
    // And only if status is running and we have personas loaded
    if (state.status === "running" && !hasStartedRef.current && !sessionIdRef.current && state.personas.length > 0) {
        hasStartedRef.current = true
        runSimulation()
    }
  }, [state.status, state.personas.length])

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
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Replay</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentScreenshot ? (
                      <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-border">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`data:image/png;base64,${currentScreenshot}`} 
                          alt="Live View" 
                          className="w-full h-full object-contain"
                        />
                        {isSimulating && (
                            <div className="absolute top-2 right-2">
                                <Badge variant="default" className="animate-pulse bg-red-500">LIVE</Badge>
                            </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-muted-foreground">
                        Waiting for stream...
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-1">
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
