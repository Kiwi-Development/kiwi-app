"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "../../../../components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Share2, X } from "lucide-react";
import { PersonaProgressList } from "./components/persona-progress-list";
import { LiveLog } from "./components/live-log";
import { EventTimeline } from "./components/event-timeline";
import { SideTabs } from "./components/side-tabs";
import { LiveBrowserView } from "./components/live-browser-view";
import type { LiveRunState, RunEvent } from "@/types";
import { useToast } from "../../../../hooks/use-toast";
import { useTestRunStream } from "@/lib/hooks/use-test-run-stream";
import { testStore, personaStore } from "@/lib/stores";
import type { PersonaProgress } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  queued: "bg-slate-500 text-slate-50",
  running: "bg-blue-500 text-blue-50",
  completed: "bg-green-500 text-green-50",
  "needs-validation": "bg-amber-500 text-amber-50",
  error: "bg-red-500 text-red-50",
  incomplete: "bg-orange-500 text-orange-50",
  cancelled: "bg-gray-500 text-gray-50",
};

const statusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  "needs-validation": "Needs Validation",
  error: "Error",
  incomplete: "Incomplete",
  cancelled: "Cancelled",
};

export default function LiveRunPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testRunId = params.id as string; // Now using testRunId from test_runs table
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const testIdFromUrl = searchParams.get("testId");

  const [state, setState] = useState<LiveRunState>({
    runId: testRunId,
    title: "Loading...",
    status: "queued",
    personas: [],
    events: [],
    logs: [],
    steps: [],
    tags: [],
    consoleTrace: [],
  });

  const [sessionReady, setSessionReady] = useState(false);
  const [liveViewUrl, setLiveViewUrl] = useState<string | undefined>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [testId, setTestId] = useState<string | null>(null); // Store test_id for navigation

  // Load test run data
  useEffect(() => {
    const loadTestRun = async () => {
      // If this is a temporary ID, load test data immediately and poll for real test run
      if (testRunId.startsWith("temp-")) {
        console.log("Temporary test run ID detected, loading test data immediately...");

        // Get testId from URL params or sessionStorage
        const testIdFromStorage = testIdFromUrl || sessionStorage.getItem(`testRun_${testRunId}`);

        if (testIdFromStorage) {
          setTestId(testIdFromStorage);
          // Load test data immediately to show tasks
          try {
            const test = await testStore.getTestById(testIdFromStorage);
            if (test) {
          const steps =
            test.testData?.tasks?.map((task, index) => ({
              index,
              title: task,
            })) || [];

              setState((prev) => ({
                ...prev,
                runId: testRunId,
            title: test.title,
                status: "queued", // Assume queued while waiting
                startedAt: Date.now(),
            steps,
              }));
            }
      } catch (error) {
            console.error("Error loading test data:", error);
          }
        }

        // Poll for the real test run ID
        // We'll poll every 500ms for up to 10 seconds
        let pollCount = 0;
        const maxPolls = 20; // 20 * 500ms = 10 seconds

        const pollInterval = setInterval(async () => {
          pollCount++;

          try {
            // Get testId to find the most recent test run for this test
            const testIdToUse = testIdFromUrl || sessionStorage.getItem(`testRun_${testRunId}`);
            if (testIdToUse) {
              setTestId(testIdToUse);
              // Fetch the most recent test run for this test
              const response = await fetch(
                `/api/test-runs?testId=${encodeURIComponent(testIdToUse)}&limit=1`
              );
              if (response.ok) {
                const data = await response.json();
                if (data.testRuns && data.testRuns.length > 0) {
                  const realTestRunId = data.testRuns[0].id;
                  if (realTestRunId && !realTestRunId.startsWith("temp-")) {
                    console.log("Found real test run ID:", realTestRunId);
                    clearInterval(pollInterval);
                    sessionStorage.removeItem(`testRun_${testRunId}`);
                    router.replace(`/dashboard/runs/${realTestRunId}`);
                    return;
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error polling for test run:", error);
          }

          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            toast({
              title: "Timeout",
              description: "Could not find test run. Please try again.",
              variant: "destructive",
            });
          }
        }, 500);

        return () => clearInterval(pollInterval);
      }

      try {
        const response = await fetch(`/api/test-runs/${testRunId}`);
        if (!response.ok) {
          if (response.status === 404) {
            // If 404 and it's not a temp ID, might be still creating - poll briefly
            console.log("Test run not found yet, might still be creating...");
            // Don't show error immediately, might still be creating
            return;
          }
          throw new Error("Failed to load test run");
        }

        const testRun = await response.json();

        // Store test_id for navigation
        setTestId(testRun.test_id);

        // Get test data to populate title and tasks
        const test = await testStore.getTestById(testRun.test_id);
        if (!test) {
          toast({
            title: "Test not found",
            description: "Could not load test data",
            variant: "destructive",
          });
          return;
        }

        const steps =
          test.testData?.tasks?.map((task, index) => ({
            index,
            title: task,
          })) || [];

        // Get persona data to populate PersonaProgress
        const personaId = (test.testData?.selectedPersona || test.heuristics?.selectedPersona) as
          | string
          | undefined;
        let personas: PersonaProgress[] = [];
        if (personaId) {
          try {
            const persona = await personaStore.getPersonaById(personaId);
            if (persona) {
              personas = [
                {
                  id: persona.id,
                  name: persona.name,
                  variant: persona.role || "Default",
                  status:
                    testRun.status === "running"
                      ? "running"
                      : testRun.status === "completed"
                        ? "completed"
                        : testRun.status === "error"
                          ? "error"
                          : "queued",
                  percent:
                    testRun.status === "completed" ? 100 : testRun.status === "running" ? 50 : 0,
                },
              ];
        }
      } catch (error) {
            console.error("Error loading persona:", error);
          }
        }

        setState((prev) => ({
          ...prev,
          runId: testRunId,
          title: test.title,
          status: testRun.status as LiveRunState["status"],
          startedAt: testRun.started_at ? new Date(testRun.started_at).getTime() : Date.now(),
          duration: testRun.duration_seconds || undefined,
          steps,
          personas,
        }));

        // If completed, redirect to reports
        if (testRun.status === "completed") {
          // Find the latest completed run for this test
          router.push(`/dashboard/reports/${testRun.test_id}`);
          return;
        }

        // If we have a browserbase session ID, construct live view URL and mark session as ready
        if (testRun.browserbase_session_id) {
          const url = `https://www.browserbase.com/sessions/${testRun.browserbase_session_id}`;
          setLiveViewUrl(url);
          setSessionReady(true); // Session is ready if we have the ID
        }
      } catch (error) {
      toast({
          title: "Error loading test run",
          description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      }
    };

    loadTestRun();
  }, [testRunId, router, toast]);

  // Handle SSE events
  const handleSSEEvent = useCallback(
    (event: { type: string; data: unknown }) => {
      console.log("SSE Event received:", event);

      switch (event.type) {
        case "connected":
          console.log("SSE connected");
          break;

        case "SESSION_READY":
          const sessionData = event.data as { browserbaseSessionId?: string; liveViewUrl?: string };
          if (sessionData.liveViewUrl) {
            setLiveViewUrl(sessionData.liveViewUrl);
            setSessionReady(true);
          } else if (sessionData.browserbaseSessionId) {
            const url = `https://www.browserbase.com/sessions/${sessionData.browserbaseSessionId}`;
            setLiveViewUrl(url);
            setSessionReady(true);
          }
          // Add technical log
        setState((prev) => ({
          ...prev,
          consoleTrace: [
            ...prev.consoleTrace,
            {
                type: "session_created",
                sessionId: sessionData.browserbaseSessionId,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
          break;

        case "progress":
          const progressData = event.data as {
            currentTask: number;
            totalTasks: number;
            status: string;
          };
          setState((prev) => {
            const percent =
              progressData.totalTasks > 0
                ? (progressData.currentTask / progressData.totalTasks) * 100
                : 0;

            // Update persona progress
            const updatedPersonas = prev.personas.map((p) => ({
              ...p,
              status:
                progressData.status === "running"
                  ? ("running" as const)
                  : progressData.status === "completed"
                    ? ("completed" as const)
                    : progressData.status === "error"
                      ? ("error" as const)
                      : ("queued" as const),
              percent: percent,
            }));

            // Navigate to report page when progress reaches 100%
            if (percent >= 100 && progressData.status === "completed") {
              // Small delay to ensure report generation has started
              setTimeout(() => {
                // Use testId from state, or get it from testRun if available
                const testIdToUse = testId || (state as any).testId;
                if (testIdToUse) {
                  router.push(`/dashboard/reports/${testIdToUse}`);
                } else {
                  // Fallback: try to get testId from the test run
                  fetch(`/api/test-runs/${testRunId}`)
                    .then((res) => res.json())
                    .then((testRun) => {
                      if (testRun.test_id) {
                        router.push(`/dashboard/reports/${testRun.test_id}`);
                      }
                    })
                    .catch((err) => console.error("Error fetching test run for navigation:", err));
                }
              }, 2000);
            }

            return {
          ...prev,
              status: progressData.status as LiveRunState["status"],
              personas: updatedPersonas,
          consoleTrace: [
            ...prev.consoleTrace,
            {
                  type: "log",
                  message: `Task ${progressData.currentTask}/${progressData.totalTasks}: ${progressData.status}`,
              timestamp: new Date().toISOString(),
            },
          ],
            };
          });
          break;

        case "persona_message":
          const personaData = event.data as { message: string; timestamp: string };
        setState((prev) => ({
          ...prev,
            logs: [
              ...prev.logs,
              {
                t: Date.now() - (prev.startedAt || Date.now()),
                text: personaData.message,
                type: "reasoning" as const,
            },
          ],
        }));
          break;

        case "event":
          const eventData = event.data as {
            id: string;
            type: string;
            label: string;
            details?: string;
            stepIndex?: number;
            t: number;
          };
        setState((prev) => ({
          ...prev,
            events: [
              ...prev.events,
              {
                id: eventData.id,
                type: eventData.type as RunEvent["type"],
                label: eventData.label,
                details: eventData.details,
                stepIndex: eventData.stepIndex,
                t: eventData.t > 1000000 ? eventData.t / 1000 : eventData.t, // Convert to seconds if in milliseconds
            },
          ],
        }));
          break;

        case "completed":
          const completedData = event.data as {
            success?: boolean;
            metrics?: {
              completedTasks: number;
              totalTasks: number;
              taskCompletionPercentage: number;
              duration: number;
              actionCount: number;
            };
          };
          setState((prev) => {
            const metrics = completedData.metrics;
            const updatedSteps = prev.steps.map((step, index) => ({
              ...step,
              pass: metrics && index < metrics.completedTasks ? true : false,
            }));
            return {
        ...prev,
        status: "completed" as const,
              duration: metrics ? Math.round(metrics.duration / 1000) : prev.duration,
              steps: updatedSteps,
            };
          });
          // Redirect to reports after a short delay (always navigate when completed)
          setTimeout(() => {
            // Use testId from state, or get it from testRun if available
            const testIdToUse = testId || (state as any).testId;
            if (testIdToUse) {
              router.push(`/dashboard/reports/${testIdToUse}`);
            } else {
              // Fallback: try to get testId from the test run
              fetch(`/api/test-runs/${testRunId}`)
                .then((res) => res.json())
                .then((testRun) => {
                  if (testRun.test_id) {
                    router.push(`/dashboard/reports/${testRun.test_id}`);
                  }
                })
                .catch((err) => console.error("Error fetching test run for navigation:", err));
            }
      }, 2000);
          break;

        case "incomplete":
        case "error":
        setState((prev) => ({
          ...prev,
            status: event.type as LiveRunState["status"],
          }));
          break;

        case "cancelled":
          setState((prev) => ({
            ...prev,
            status: "cancelled" as const,
          }));
            break;
          }
    },
    [testRunId, router, testId]
  );

  // Set up SSE stream - enable for real test run IDs only (temporary IDs will be replaced)
  const { isConnected, error: streamError } = useTestRunStream({
    testRunId,
    onEvent: handleSSEEvent,
    enabled:
      !testRunId.startsWith("temp-") && (state.status === "queued" || state.status === "running"),
  });

  // Handle cancellation
  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/test-runs/${testRunId}/cancel`, {
            method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel test run");
      }

      toast({
        title: "Test run cancelled",
        description: "The test run has been cancelled successfully",
      });

      setCancelDialogOpen(false);
      router.push("/dashboard/tests");
        } catch (error) {
        toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel test run",
          variant: "destructive",
        });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Run link copied to clipboard",
    });
  };

  const handleEventClick = (event: RunEvent) => {
    // Events use milliseconds, logs also use milliseconds
    // Find the log entry closest to this event's timestamp
    const eventTimeMs = event.t; // Already in milliseconds
    const closestLog = state.logs.find((log, index) => {
      const logTime = typeof log.t === "number" ? log.t : 0;
      const nextLogTime = state.logs[index + 1]?.t || Infinity;
      // Find log within 2 seconds of event time
      return Math.abs(logTime - eventTimeMs) < 2000;
    });

    if (closestLog) {
      // Scroll to the log entry in the Live Log component
      const logElement = document.querySelector(`[data-log-time="${closestLog.t}"]`);
      if (logElement) {
        logElement.scrollIntoView({ behavior: "smooth", block: "center" });
        // Highlight the log entry temporarily
        logElement.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          logElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }

    // Show event details in a toast
    import("../../../../lib/utils/time-format")
      .then(({ formatTimeStandard }) => {
    toast({
          title: event.label,
          description: event.details || `Event occurred at ${formatTimeStandard(event.t)}`,
        });
      })
      .catch(() => {
        // Fallback if import fails
        toast({
          title: event.label,
          description: event.details || "Event occurred",
        });
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>
        <main className="container mx-auto p-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{state.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={statusColors[state.status] || statusColors.queued}>
                    {statusLabels[state.status] || "Unknown"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(state.status === "queued" || state.status === "running") && (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={isCancelling}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between w-full">
                        <CardTitle className="text-lg">Live Browser View</CardTitle>
                        {state.status === "running" && (
                          <Badge
                            variant="destructive"
                            className="bg-red-500 text-white"
                            style={{
                              animation: "flash-red-white 1s ease-in-out infinite",
                            }}
                          >
                                LIVE
                              </Badge>
                        )}
                        <style jsx>{`
                          @keyframes flash-red-white {
                            0%,
                            100% {
                              background-color: rgb(239, 68, 68);
                              color: white;
                            }
                            50% {
                              background-color: white;
                              color: rgb(239, 68, 68);
                            }
                          }
                        `}</style>
                        </div>
                    </CardHeader>
                    <CardContent>
                      <LiveBrowserView sessionReady={sessionReady} liveViewUrl={liveViewUrl} />
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="space-y-6 lg:col-span-1">
                {/* Metrics Card */}
                {(state.status === "completed" || state.status === "error") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Test Run Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {state.steps.length > 0
                              ? Math.round(
                                  (state.steps.filter((s) => s.pass === true).length /
                                    state.steps.length) *
                                    100
                                )
                              : 0}
                            %
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Task Success</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {state.duration
                              ? `${Math.floor(state.duration / 60)}:${String(
                                  state.duration % 60
                                ).padStart(2, "0")}`
                              : "0:00"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Time</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{state.steps.length}</div>
                          <div className="text-xs text-muted-foreground mt-1">Actions</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      highlightedEventId={undefined}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <SideTabs tasks={state.steps} consoleTrace={state.consoleTrace} />
              </CardContent>
            </Card>
          </div>
        </main>
      </AppLayout>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Test Run?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this test run? This action cannot be undone and any
              progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Cancel Test Run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
