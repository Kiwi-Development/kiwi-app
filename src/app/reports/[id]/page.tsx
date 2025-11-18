"use client"

import { AppLayout } from "../../../../components/app-layout"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Badge } from "../../../../components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { Textarea } from "../../../../components/ui/textarea"
import { useToast } from "../../../../hooks/use-toast"
import { Share2, FileDown, Play, CheckCircle2, XCircle, TrendingUp, RotateCcw, Target, X } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { testStore } from "../../../../lib/test-store"
import { Dialog, DialogContent, DialogTitle } from "../../../../components/ui/dialog"
import { Slider } from "../../../../components/ui/slider"
import { ReplayPlayer } from "../../runs/[id]/components/replay-player"

type ValidationStatus = 'validated' | 'refuted' | null;

interface Finding {
  id: number;
  title: string;
  severity: string;
  confidence: number;
  ood: boolean;
  timestamp: string;
  description: string;
  suggestedFix: string;
  affectingTasks: string[];
  affectingPersonas: string[];
  validated: ValidationStatus;
  note: string;
}

const findings: Finding[] = [
  {
    id: 1,
    title: "Grid view switcher lacks visual feedback",
    severity: "High",
    confidence: 68,
    ood: false,
    timestamp: "00:37",
    description:
      "Users click the grid view button multiple times because there's no clear indication that the view is changing.",
    suggestedFix: "Add loading state and visual confirmation when grid view changes",
    affectingTasks: ["Task 1"],
    affectingPersonas: ["Novice", "Time-pressed"],
    validated: null,
    note: "",
  },
  {
    id: 2,
    title: "Model comparison export button is hidden",
    severity: "Med",
    confidence: 54,
    ood: true,
    timestamp: "02:14",
    description: "Users struggle to find the export functionality after selecting models for comparison.",
    suggestedFix: "Make export button more prominent in the comparison toolbar",
    affectingTasks: ["Task 3"],
    affectingPersonas: ["Time-pressed"],
    validated: null,
    note: "",
  },
  {
    id: 3,
    title: "Keyboard navigation skips model cards",
    severity: "Low",
    confidence: 71,
    ood: false,
    timestamp: "03:05",
    description: "Tab order skips model selection cards, breaking keyboard navigation flow.",
    suggestedFix: "Fix tab order; ensure all interactive elements are keyboard accessible",
    affectingTasks: ["Task 2"],
    affectingPersonas: ["Keyboard-only"],
    validated: null,
    note: "",
  },
]

export default function ReportPage() {
  const params = useParams()
  const testId = params.id as string
  const [findingStates, setFindingStates] = useState<Finding[]>(findings)
  const [variant, setVariant] = useState<"A" | "B">("A")
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [selectedTimestamp, setSelectedTimestamp] = useState("")
  const { toast } = useToast()

  const [testData, setTestData] = useState<any>(null)

  useEffect(() => {
    const test = testStore.getTestById(testId)
    setTestData(test)
  }, [testId])

  const getMetrics = (variantType: "A" | "B") => {
    if (!testData || testData.status !== "completed") {
      return {
        taskSuccess: 0,
        avgTime: "0:00",
        backtracks: 0,
      }
    }

    if (variantType === "A") {
      return {
        taskSuccess: 72,
        avgTime: "4:32",
        backtracks: 8,
      }
    } else {
      return {
        taskSuccess: 89,
        avgTime: "3:16",
        backtracks: 3,
      }
    }
  }

  const metricsA = getMetrics("A")
  const metricsB = getMetrics("B")

  const handleShare = () => {
    toast({
      title: "Link copied",
      description: "Demo-safe URL copied to clipboard",
    })
  }

  const handleExport = () => {
    const element = document.createElement("a")
    const content = `Kiwi Usability Test Report\n\nTest: ${testData?.title}\nStatus: ${testData?.status}\n\nVariant A Metrics:\nTask Success: ${metricsA.taskSuccess}%\nAvg Time: ${metricsA.avgTime}\n\nVariant B Metrics:\nTask Success: ${metricsB.taskSuccess}%\nAvg Time: ${metricsB.avgTime}\n\nFindings: ${findings.length} issues identified`
    const file = new Blob([content], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = `kiwi-report-${testId}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)

    toast({
      title: "Export started",
      description: "PDF report will download shortly",
    })
  }

  const handleValidation = (id: number, status: "validated" | "refuted") => {
    setFindingStates((prev) => prev.map((f) => (f.id === id ? { ...f, validated: status } : f)))
    toast({
      title: status === "validated" ? "Finding validated" : "Finding refuted",
      description: "Your feedback has been recorded",
    })
  }

  const handleCounterfactual = () => {
    toast({
      title: "Counterfactual queued",
      description: "Re-running test with suggested copy changes",
    })
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [volume, setVolume] = useState(0.5);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Convert timestamp to seconds
  const getTimeInSeconds = useCallback((timestamp: string) => {
    const [minutes, seconds] = timestamp.split(':').map(Number);
    return (minutes * 60) + seconds;
  }, []);

  const handleCanPlay = useCallback(() => {
      if (selectedTimestamp && videoRef.current) {
        const timeInSeconds = getTimeInSeconds(selectedTimestamp);
        videoRef.current.currentTime = timeInSeconds;
        videoRef.current.muted = true; // Mute for autoplay
        videoRef.current.play().catch(e => {
          console.log("Autoplay blocked, user interaction required");
        });
      }
    }, [selectedTimestamp, getTimeInSeconds]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));
    video.addEventListener('timeupdate', () => setCurrentTime(video.currentTime));
    video.addEventListener('durationchange', () => setDuration(video.duration));
    video.addEventListener('seeking', () => setIsPlaying(false));
    video.addEventListener('seeked', () => {
      if (!video.paused) {
        video.play().catch(console.error);
      }
    });

    // Initial setup
    if (selectedTimestamp) {
    const timeInSeconds = getTimeInSeconds(selectedTimestamp);
      if (video.readyState >= 2) {
        video.currentTime = timeInSeconds;
        video.muted = true;
        video.play().catch(console.error);
      }
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', () => {});
      video.removeEventListener('pause', () => {});
      video.removeEventListener('timeupdate', () => {});
      video.removeEventListener('durationchange', () => {});
      video.removeEventListener('seeking', () => {});
      video.removeEventListener('seeked', () => {});
    };
  }, [handleCanPlay, selectedTimestamp, getTimeInSeconds]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Player controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(e => {
        // If autoplay was prevented, mute and try again
        video.muted = true;
        video.play().catch(console.error);
      });
    } else {
      video.pause();
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value[0];
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleJumpToProof = (timestamp: string) => {
    setSelectedTimestamp(timestamp);
    setVideoDialogOpen(true);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedTimestamp) return;

    const seekToTime = () => {
      const timeInSeconds = getTimeInSeconds(selectedTimestamp);
      if (isFinite(timeInSeconds)) {
        video.currentTime = timeInSeconds;
        video.muted = true;
        setCurrentTime(timeInSeconds);
        video.play().catch(e => {
          console.log("Autoplay blocked, user interaction required");
        });
      }
    };

    // Try to seek immediately if possible
    if (video.readyState >= 2) {
      seekToTime();
    }

    // Also set up the canplay event as a fallback
    const handleCanPlay = () => {
      seekToTime();
      video.removeEventListener('canplay', handleCanPlay);
    };

    video.addEventListener('canplay', handleCanPlay);
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [selectedTimestamp, getTimeInSeconds]);

  const currentMetrics = variant === "A" ? metricsA : metricsB

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>

      <main className="container mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{testData?.title || "Evaluations Page Design A"}</h1>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <Badge variant="secondary">Jenny Park</Badge>
                <Badge variant="secondary">Novice</Badge>
                <Badge variant="secondary">Time-pressed</Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                • {testData?.status === "completed" ? "Completed 2 hours ago" : "Running"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <Tabs value={variant} onValueChange={(v) => setVariant(v as "A" | "B")}>
          <TabsList>
            <TabsTrigger value="A">Variant A</TabsTrigger>
            <TabsTrigger value="B">Variant B</TabsTrigger>
          </TabsList>

          <TabsContent value={variant} className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Task Success</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentMetrics.taskSuccess}%</div>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Avg Time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentMetrics.avgTime}</div>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Backtracks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentMetrics.backtracks}</div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Findings</h2>
              </div>

              {findingStates.map((finding) => (
                <Card key={finding.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              finding.severity === "High"
                                ? "destructive"
                                : finding.severity === "Med"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {finding.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">Confidence: {finding.confidence}%</span>
                        </div>
                        <CardTitle className="text-xl">{finding.title}</CardTitle>
                        <CardDescription className="text-base">{finding.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-start gap-3">
                        <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                          <p className="text-sm font-semibold">Suggested Fix</p>
                          <p className="text-sm text-muted-foreground">{finding.suggestedFix}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCounterfactual}
                            className="mt-2 bg-transparent"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            One-click Counterfactual
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-transparent"
                        onClick={() => handleJumpToProof(finding.timestamp)}
                      >
                        <Play className="h-4 w-4" />
                        Jump to {finding.timestamp}
                      </Button>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Affecting:</span>
                        {finding.affectingTasks.map((task) => (
                          <Badge key={task} variant="outline" className="text-xs">
                            {task}
                          </Badge>
                        ))}
                        {finding.affectingPersonas.map((persona) => (
                          <Badge key={persona} variant="outline" className="text-xs">
                            {persona}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Manual Override</p>
                        {finding.validated && (
                          <Badge variant={finding.validated === "validated" ? "default" : "secondary"}>
                            {finding.validated === "validated" ? "Validated" : "Refuted"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidation(finding.id, "validated")}
                          disabled={finding.validated === "validated"}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Validate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidation(finding.id, "refuted")}
                          disabled={finding.validated === "refuted"}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refute
                        </Button>
                      </div>
                      <Textarea placeholder="Add notes about this finding..." className="min-h-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Compare A vs B
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Variant A</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Task Success: {metricsA.taskSuccess}%</div>
                      <div>Avg Time: {metricsA.avgTime}</div>
                      <div>Backtracks: {metricsA.backtracks}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Variant B</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Task Success: {metricsB.taskSuccess}% (+17%)</div>
                      <div>Avg Time: {metricsB.avgTime} (-28%)</div>
                      <div>Backtracks: {metricsB.backtracks} (-63%)</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm font-semibold text-foreground">Recommendation</p>
                  <p className="text-sm text-muted-foreground mt-1">Ship Variant B with improved visual feedback</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>Prioritized actions to improve the user experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      UX
                    </Badge>
                    <p className="text-sm flex-1">Add loading state and visual confirmation for grid view changes</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      IA
                    </Badge>
                    <p className="text-sm flex-1">Make export button more prominent in the comparison toolbar</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      A11y
                    </Badge>
                    <p className="text-sm flex-1">Fix tab order and ensure all model cards are keyboard accessible</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button>Send to Slack</Button>
                  <Button variant="outline">Schedule Human Validation</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calibration & Trust</CardTitle>
                <CardDescription>Model performance metrics over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precision@5</span>
                      <span className="text-sm font-semibold">84%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">False Positive Rate</span>
                      <span className="text-sm font-semibold">12%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Validation Turnaround</span>
                      <span className="text-sm font-semibold">2.3 days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Inter-rater Agreement</span>
                      <span className="text-sm font-semibold">89%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-6xl p-0 bg-black/90 border-0">
          <DialogTitle className="sr-only">Video Player</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => setVideoDialogOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="p-4">
            <ReplayPlayer
              videoUrl="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/test_video-UOVNF3qfZLAN4grybvKaejGMEHvvPG.mp4"
              events={[]}
              initialTime={selectedTimestamp ? getTimeInSeconds(selectedTimestamp) : 0}
              onSeek={(time) => setSelectedTimestamp(time.toString())}
            />
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
    </div>
  )
}
