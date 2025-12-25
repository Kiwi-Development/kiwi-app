"use client";

import { AppLayout } from "../../../../components/app-layout";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Textarea } from "../../../../components/ui/textarea";
import { useToast } from "../../../../../hooks/use-toast";
import {
  Share2,
  FileDown,
  Play,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RotateCcw,
  Target,
  X,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { testStore } from "../../../../lib/test-store";
import { Dialog, DialogContent, DialogTitle } from "../../../../components/ui/dialog";
import { Slider } from "../../../../components/ui/slider";
import { ReplayPlayer } from "../../runs/[id]/components/replay-player";

type ValidationStatus = "validated" | "refuted" | null;

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
    description:
      "Users struggle to find the export functionality after selecting models for comparison.",
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
];

import { personaStore } from "../../../../lib/persona-store";

// ... existing imports ...

export default function ReportPage() {
  const params = useParams();
  const testId = params.id as string;
  const [findingStates, setFindingStates] = useState<Finding[]>([]);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState("");
  const { toast } = useToast();

  const [testData, setTestData] = useState<ReturnType<typeof testStore.getTestById> | null>(null);
  const [persona, setPersona] = useState<ReturnType<typeof personaStore.getPersonas>[0] | null>(
    null
  );

  useEffect(() => {
    const test = testStore.getTestById(testId);
    // Initialize state from store - this is acceptable for one-time initialization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTestData(test);

    if (test?.testData?.selectedPersona) {
      const p = personaStore.getPersonas().find((p) => p.id === test.testData!.selectedPersona);
      if (p) {
        setPersona(p);
      }
    }

    if (test?.findings !== undefined) {
      // Test has findings from agent (even if empty array)
      const mappedFindings = test.findings.map(
        (
          f: {
            title: string;
            severity: string;
            confidence?: number;
            description?: string;
            suggestedFix?: string;
            affectingTasks?: string[];
          },
          index: number
        ) => ({
          id: index + 1,
          title: f.title,
          severity: f.severity,
          confidence: f.confidence ?? 0,
          ood: false, // Default
          timestamp: "00:00", // Default
          description: f.description ?? "",
          suggestedFix: f.suggestedFix ?? "",
          affectingTasks: f.affectingTasks ?? [],
          affectingPersonas: test.testData?.selectedPersona
            ? [
                personaStore.getPersonas().find((p) => p.id === test.testData!.selectedPersona)
                  ?.name || "User",
              ]
            : [],
          validated: null,
          note: "",
        })
      );
      setFindingStates(mappedFindings);
    } else {
      // Test not run yet - show demo findings
      setFindingStates(findings);
    }
  }, [testId]);

  const handleValidation = (id: number, status: "validated" | "refuted") => {
    setFindingStates((prev) => prev.map((f) => (f.id === id ? { ...f, validated: status } : f)));
    toast({
      title: status === "validated" ? "Finding validated" : "Finding refuted",
      description: "Your feedback has been recorded",
    });
  };

  const handleCounterfactual = () => {
    toast({
      title: "Counterfactual queued",
      description: "Re-running test with suggested copy changes",
    });
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoCurrentTime, setCurrentTime] = useState(0);
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
    const [minutes, seconds] = timestamp.split(":").map(Number);
    return minutes * 60 + seconds;
  }, []);

  const handleCanPlay = useCallback(() => {
    if (selectedTimestamp && videoRef.current) {
      const timeInSeconds = getTimeInSeconds(selectedTimestamp);
      videoRef.current.currentTime = timeInSeconds;
      videoRef.current.muted = true; // Mute for autoplay
      videoRef.current.play().catch((e) => {
        console.log("Autoplay blocked, user interaction required");
      });
    }
  }, [selectedTimestamp, getTimeInSeconds]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", () => setIsPlaying(true));
    video.addEventListener("pause", () => setIsPlaying(false));
    video.addEventListener("timeupdate", () => setCurrentTime(video.currentTime));
    video.addEventListener("durationchange", () => setDuration(video.duration));
    video.addEventListener("seeking", () => setIsPlaying(false));
    video.addEventListener("seeked", () => {
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
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", () => {});
      video.removeEventListener("pause", () => {});
      video.removeEventListener("timeupdate", () => {});
      video.removeEventListener("durationchange", () => {});
      video.removeEventListener("seeking", () => {});
      video.removeEventListener("seeked", () => {});
    };
  }, [handleCanPlay, selectedTimestamp, getTimeInSeconds]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Player controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch((e) => {
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
      videoRef.current?.requestFullscreen().catch((err) => {
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
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleJumpToProof = (timestamp: string) => {
    setSelectedTimestamp(timestamp);
    setVideoDialogOpen(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedTimestamp) return;

    const seekToTime = () => {
      const timeInSeconds = getTimeInSeconds(selectedTimestamp);
      if (isFinite(timeInSeconds)) {
        video.currentTime = timeInSeconds;
        video.muted = true;
        setCurrentTime(timeInSeconds);
        video.play().catch((e) => {
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
      video.removeEventListener("canplay", handleCanPlay);
    };

    video.addEventListener("canplay", handleCanPlay);
    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [selectedTimestamp, getTimeInSeconds]);

  const [renderTime] = useState(() => Date.now());
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((renderTime - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Report link copied to clipboard",
    });
  };

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background print:bg-white print:h-auto print:overflow-visible">
      <AppLayout>
        <main className="container mx-auto p-6 print:p-0 print:max-w-none print:h-auto print:overflow-visible">
          <div className="flex items-start justify-between print:hidden">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {testData?.title || "Evaluations Page Design A"}
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {persona ? (
                    <>
                      <Badge variant="secondary">{persona.name}</Badge>
                      {persona.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </>
                  ) : (
                    <Badge variant="secondary">Loading Persona...</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  •{" "}
                  {testData?.completedAt
                    ? `Completed ${formatTimeAgo(testData.completedAt)}`
                    : "Running"}
                </span>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
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

          <div className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Task Success</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{testData?.successRate ?? 0}%</div>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {testData?.duration ? formatDuration(testData.duration) : "0:00"}
                  </div>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardDescription>Actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{testData?.actionCount || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {testData?.feedback && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Agent Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {testData.feedback}
                    </p>
                  </CardContent>
                </Card>
              )}

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
                          <span className="text-sm text-muted-foreground">
                            Confidence: {finding.confidence}%
                          </span>
                        </div>
                        <CardTitle className="text-xl">{finding.title}</CardTitle>
                        <CardDescription className="text-base">
                          {finding.description}
                        </CardDescription>
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
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
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
                          <Badge
                            variant={finding.validated === "validated" ? "default" : "secondary"}
                          >
                            {finding.validated === "validated" ? "Validated" : "Refuted"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 print:hidden">
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
                      <Textarea
                        placeholder="Add notes about this finding..."
                        className="min-h-20"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>
                  Prioritized actions to improve the user experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      User Experience
                    </Badge>
                    <p className="text-sm flex-1">
                      Add loading state and visual confirmation for grid view changes
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      Information Architecture
                    </Badge>
                    <p className="text-sm flex-1">
                      Make export button more prominent in the comparison toolbar
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5">
                      Accessibility
                    </Badge>
                    <p className="text-sm flex-1">
                      Fix tab order and ensure all model cards are keyboard accessible
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
  );
}
