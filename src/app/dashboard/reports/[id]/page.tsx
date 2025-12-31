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
import { useToast } from "../../../../hooks/use-toast";
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
  Save,
  BookOpen,
  Code,
  FileText,
  ExternalLink,
  GitCompare,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { testStore } from "../../../../lib/test-store";
import { Dialog, DialogContent, DialogTitle } from "../../../../components/ui/dialog";
import { Slider } from "../../../../components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { ReplayPlayer } from "../../runs/[id]/components/replay-player";
import { supabase } from "../../../../lib/supabase";

type ValidationStatus = "validated" | "refuted" | null;

interface KnowledgeCitation {
  chunk_id: string;
  source: string;
  title: string;
  category: string;
  content?: string;
}

interface DeveloperOutput {
  codeSnippets?: Array<{
    type: string;
    language: string;
    code: string;
    description: string;
  }>;
  specs?: Array<{
    type: string;
    content: string;
    description: string;
  }>;
  tickets?: Array<{
    type: string;
    title: string;
    body: string;
    labels: string[];
  }>;
}

interface EvidenceSnippet {
  persona_name: string;
  persona_role: string;
  task_context: string;
  what_happened_steps: string[];
  persona_quote?: string;
  ui_anchor?: {
    frame_name?: string;
    element_label?: string;
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    element_selector?: string;
  };
  timestamp?: string;
  screenshot_index?: number;
}

interface Finding {
  id: number;
  feedbackEntryId?: string; // UUID from database
  title: string;
  severity: string;
  confidence: number;
  confidence_level?: "Low" | "Med" | "High";
  category?:
    | "navigation"
    | "copy"
    | "affordance_feedback"
    | "forms"
    | "hierarchy"
    | "accessibility"
    | "conversion"
    | "other";
  frequency?: number; // How many times this finding appeared (clustered)
  triggered_by_tasks?: string[]; // Tasks that triggered this finding
  triggered_by_personas?: string[]; // Personas that triggered this finding
  evidence_snippets?: EvidenceSnippet[]; // Evidence for this finding
  ood: boolean;
  timestamp: string;
  description: string;
  suggestedFix: string;
  affectingTasks: string[];
  affectingPersonas: string[];
  validated: ValidationStatus;
  note: string;
  hasUnsavedChanges?: boolean; // Track if validation/note has changed
  knowledge_citations?: KnowledgeCitation[]; // Citations from knowledge base
  developer_outputs?: DeveloperOutput; // Generated code snippets, specs, tickets
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

  const [testData, setTestData] = useState<Awaited<
    ReturnType<typeof testStore.getTestById>
  > | null>(null);
  const [persona, setPersona] = useState<
    Awaited<ReturnType<typeof personaStore.getPersonas>>[0] | null
  >(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [testRuns, setTestRuns] = useState<
    Array<{
      id: string;
      created_at: string;
      status: string;
      task_completion_percentage: number | null;
    }>
  >([]);

  useEffect(() => {
    const loadData = async () => {
      const test = await testStore.getTestById(testId);
      setTestData(test);

      if (test?.testData?.selectedPersona) {
        const allPersonas = await personaStore.getPersonas();
        const p = allPersonas.find((p) => p.id === test.testData!.selectedPersona);
        if (p) {
          setPersona(p);
        }
      }

      // Load all test_runs for this test
      const { data: allRuns } = await supabase
        .from("test_runs")
        .select("id, created_at, status, task_completion_percentage")
        .eq("test_id", testId)
        .order("created_at", { ascending: false });

      if (allRuns && allRuns.length > 0) {
        setTestRuns(allRuns);
        // Default to latest run if no selection
        if (!selectedRunId) {
          setSelectedRunId(allRuns[0].id);
        }
      }

      if (test?.findings !== undefined) {
        // Test has findings from agent (even if empty array)
        const allPersonas = await personaStore.getPersonas();
        const personaName = test.testData?.selectedPersona
          ? allPersonas.find((p) => p.id === test.testData!.selectedPersona)?.name || "User"
          : "User";

        // Load feedback entries from database to get IDs and validation data
        // Use selected run or latest run
        const runIdToLoad = selectedRunId || allRuns?.[0]?.id;
        const { data: selectedRun } = await supabase
          .from("test_runs")
          .select("id")
          .eq("id", runIdToLoad || "")
          .maybeSingle();

        let feedbackEntries: Array<{
          id: string;
          validated: boolean | null;
          validation_note: string | null;
          title: string;
          severity: string;
          confidence_level?: "Low" | "Med" | "High";
          category?:
            | "navigation"
            | "copy"
            | "affordance_feedback"
            | "forms"
            | "hierarchy"
            | "accessibility"
            | "conversion"
            | "other";
          frequency?: number;
          triggered_by_tasks?: string[];
          triggered_by_personas?: string[];
          evidence_snippets?: EvidenceSnippet[] | null;
          knowledge_citations?: KnowledgeCitation[] | null;
          developer_outputs?: DeveloperOutput | null;
          [key: string]: unknown;
        }> = [];
        if (selectedRun?.id) {
          const { data } = await supabase
            .from("feedback_entries")
            .select("*")
            .eq("test_run_id", selectedRun.id)
            .order("created_at", { ascending: false });
          feedbackEntries = data || [];
        }

        const mappedFindings = test.findings.map(
          (
            f: {
              title: string;
              severity: string;
              confidence?: number;
              category?: string;
              description?: string;
              suggestedFix?: string;
              affectingTasks?: string[];
              citations?: KnowledgeCitation[];
              knowledge_citations?: KnowledgeCitation[];
              developer_outputs?: DeveloperOutput;
            },
            index: number
          ) => {
            // Find matching feedback entry by title (or use index as fallback)
            const feedbackEntry =
              feedbackEntries.find((fe) => fe.title === f.title) || feedbackEntries[index];

            // Get citations from feedback entry or finding
            const citations =
              feedbackEntry?.knowledge_citations || f.knowledge_citations || f.citations || [];
            const developerOutputs = feedbackEntry?.developer_outputs || f.developer_outputs;

            // Ensure confidence is a number
            const confidenceValue =
              typeof f.confidence === "number"
                ? f.confidence
                : typeof feedbackEntry?.confidence === "number"
                  ? feedbackEntry.confidence
                  : 0;

            // Ensure category is valid
            const validCategories = [
              "navigation",
              "copy",
              "affordance_feedback",
              "forms",
              "hierarchy",
              "accessibility",
              "conversion",
              "other",
            ] as const;
            const categoryValue = (feedbackEntry?.category || f.category) as
              | (typeof validCategories)[number]
              | undefined;
            const category =
              categoryValue && validCategories.includes(categoryValue) ? categoryValue : undefined;

            return {
              id: index + 1,
              feedbackEntryId: feedbackEntry?.id,
              title: f.title,
              severity: f.severity,
              confidence: confidenceValue,
              confidence_level: feedbackEntry?.confidence_level,
              category: category,
              frequency: feedbackEntry?.frequency || 1,
              triggered_by_tasks: feedbackEntry?.triggered_by_tasks || f.affectingTasks || [],
              triggered_by_personas:
                feedbackEntry?.triggered_by_personas ||
                (test.testData?.selectedPersona ? [personaName] : []),
              evidence_snippets:
                feedbackEntry?.evidence_snippets && Array.isArray(feedbackEntry.evidence_snippets)
                  ? feedbackEntry.evidence_snippets
                  : [],
              ood: false, // Default
              timestamp: "00:00", // Default
              description: f.description ?? "",
              suggestedFix: f.suggestedFix ?? "",
              affectingTasks: f.affectingTasks ?? [],
              affectingPersonas: test.testData?.selectedPersona ? [personaName] : [],
              validated: (feedbackEntry?.validated === true
                ? "validated"
                : feedbackEntry?.validated === false
                  ? "refuted"
                  : null) as ValidationStatus,
              note: feedbackEntry?.validation_note || "",
              hasUnsavedChanges: false,
              knowledge_citations: Array.isArray(citations) ? citations : [],
              developer_outputs: developerOutputs || undefined,
            };
          }
        );
        setFindingStates(mappedFindings);
      } else {
        // Test not run yet - show demo findings
        setFindingStates(findings);
      }
    };
    loadData();
  }, [testId, selectedRunId]);

  const handleValidation = (id: number, status: "validated" | "refuted") => {
    setFindingStates((prev) =>
      prev.map((f) => (f.id === id ? { ...f, validated: status, hasUnsavedChanges: true } : f))
    );
  };

  const handleNoteChange = (id: number, note: string) => {
    setFindingStates((prev) =>
      prev.map((f) => (f.id === id ? { ...f, note, hasUnsavedChanges: true } : f))
    );
  };

  const handleSaveValidation = async (finding: Finding) => {
    if (!finding.feedbackEntryId) {
      toast({
        title: "Error",
        description: "Cannot save: feedback entry ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to save validation",
          variant: "destructive",
        });
        return;
      }

      const updateData: {
        validated: boolean | null;
        validation_note: string | null;
        validated_at?: string | null;
        validated_by?: string | null;
      } = {
        validated:
          finding.validated === "validated" ? true : finding.validated === "refuted" ? false : null,
        validation_note: finding.note || null,
      };

      // Only set validated_at and validated_by if validated is not null
      if (updateData.validated !== null) {
        updateData.validated_at = new Date().toISOString();
        updateData.validated_by = session.user.id;
      } else {
        updateData.validated_at = null;
        updateData.validated_by = null;
      }

      const { error } = await supabase
        .from("feedback_entries")
        .update(updateData)
        .eq("id", finding.feedbackEntryId);

      if (error) {
        console.error("Error saving validation:", error);
        toast({
          title: "Error",
          description: "Failed to save validation",
          variant: "destructive",
        });
        return;
      }

      // Update local state to mark as saved
      setFindingStates((prev) =>
        prev.map((f) => (f.id === finding.id ? { ...f, hasUnsavedChanges: false } : f))
      );

      toast({
        title: "Saved",
        description: "Validation and note have been saved",
      });
    } catch (error) {
      console.error("Error in handleSaveValidation:", error);
      toast({
        title: "Error",
        description: "Failed to save validation",
        variant: "destructive",
      });
    }
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
            <div className="flex items-center gap-4">
              {testRuns.length > 1 && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Run:</span>
                    <Select
                      value={selectedRunId || testRuns[0]?.id || ""}
                      onValueChange={setSelectedRunId}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {testRuns.map((run, idx) => {
                          const date = new Date(run.created_at);
                          const dateStr = date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const completion = run.task_completion_percentage
                            ? `${Math.round(run.task_completion_percentage)}%`
                            : "—";
                          // Runs are sorted descending (most recent first), so idx 0 = Run 1, idx 1 = Run 2, etc.
                          return (
                            <SelectItem key={run.id} value={run.id}>
                              Run {idx + 1} • {dateStr} • {completion}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {testRuns.length >= 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Compare all runs within this test
                        window.location.href = `/dashboard/tests/compare?testId=${testId}`;
                      }}
                      title="Compare all runs within this test"
                    >
                      <GitCompare className="h-4 w-4 mr-2" />
                      Compare All Runs ({testRuns.length})
                    </Button>
                  )}
                </>
              )}
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
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge
                            variant={
                              finding.severity === "Blocker" || finding.severity === "High"
                                ? "destructive"
                                : finding.severity === "Med"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {finding.severity}
                          </Badge>
                          {finding.category && (
                            <Badge variant="outline" className="capitalize">
                              {finding.category.replace("_", " ")}
                            </Badge>
                          )}
                          {finding.frequency && finding.frequency > 1 && (
                            <Badge variant="secondary">{finding.frequency}x</Badge>
                          )}
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
                        <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="space-y-2 flex-1">
                          <p className="text-sm font-semibold">Suggested Fix</p>
                          <p className="text-sm text-muted-foreground">{finding.suggestedFix}</p>
                        </div>
                      </div>
                    </div>

                    {/* Knowledge Citations - Hidden per user request */}

                    {/* Evidence Snippets */}
                    {finding.evidence_snippets &&
                      Array.isArray(finding.evidence_snippets) &&
                      finding.evidence_snippets.length > 0 && (
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <div className="space-y-4 flex-1">
                              <p className="text-sm font-semibold">Evidence</p>
                              {finding.evidence_snippets.map((evidence, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-md bg-background border border-border space-y-2"
                                >
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">{evidence.persona_name}</span>
                                    <span>•</span>
                                    <span>{evidence.persona_role}</span>
                                    {evidence.task_context && (
                                      <>
                                        <span>•</span>
                                        <span>{evidence.task_context}</span>
                                      </>
                                    )}
                                  </div>

                                  {evidence.what_happened_steps &&
                                    evidence.what_happened_steps.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-xs font-medium">What happened:</p>
                                        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                          {evidence.what_happened_steps.map((step, stepIdx) => (
                                            <li key={stepIdx}>{step}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                  {evidence.persona_quote && (
                                    <div className="p-2 rounded bg-muted/50 border-l-2 border-primary">
                                      <p className="text-xs italic text-muted-foreground">
                                        "{evidence.persona_quote}"
                                      </p>
                                    </div>
                                  )}

                                  {evidence.ui_anchor && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium">UI Element:</span>{" "}
                                      {evidence.ui_anchor.element_label ||
                                        evidence.ui_anchor.element_selector ||
                                        "Unknown"}
                                      {evidence.ui_anchor.frame_name && (
                                        <span className="ml-2">
                                          ({evidence.ui_anchor.frame_name})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Developer Outputs */}
                    {finding.developer_outputs &&
                      ((finding.developer_outputs.codeSnippets?.length ?? 0) > 0 ||
                        (finding.developer_outputs.specs?.length ?? 0) > 0 ||
                        (finding.developer_outputs.tickets?.length ?? 0) > 0) && (
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-start gap-3">
                            <Code className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                            <div className="space-y-4 flex-1">
                              <p className="text-sm font-semibold">Developer Outputs</p>

                              {/* Code Snippets */}
                              {finding.developer_outputs.codeSnippets &&
                                finding.developer_outputs.codeSnippets.length > 0 && (
                                  <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Code Snippets
                                    </p>
                                    {finding.developer_outputs.codeSnippets.map((snippet, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-md bg-background border border-border"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="text-xs">
                                            {snippet.language}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {snippet.description}
                                          </span>
                                        </div>
                                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                          <code>{snippet.code}</code>
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                )}

                              {/* Specs */}
                              {finding.developer_outputs.specs &&
                                finding.developer_outputs.specs.length > 0 && (
                                  <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Specifications
                                    </p>
                                    {finding.developer_outputs.specs.map((spec, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-md bg-background border border-border"
                                      >
                                        <p className="text-xs text-muted-foreground mb-2">
                                          {spec.description}
                                        </p>
                                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                          <code>{spec.content}</code>
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                )}

                              {/* Tickets */}
                              {finding.developer_outputs.tickets &&
                                finding.developer_outputs.tickets.length > 0 && (
                                  <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Issue Tickets
                                    </p>
                                    {finding.developer_outputs.tickets.map((ticket, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-md bg-background border border-border"
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <p className="text-sm font-medium">{ticket.title}</p>
                                          <div className="flex gap-1 flex-wrap">
                                            {ticket.labels.map((label, labelIdx) => (
                                              <Badge
                                                key={labelIdx}
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {label}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                          {ticket.body}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Show which tasks are affected, if any */}
                    {finding.affectingTasks && finding.affectingTasks.length > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">Affects tasks:</span>
                          <div className="flex gap-2 flex-wrap">
                            {finding.affectingTasks.map((task, idx) => {
                              // Handle both string ("Task 1") and number (1) formats
                              let taskIndex: number | null = null;

                              if (typeof task === "number") {
                                // If it's a number, use it directly (1-indexed)
                                taskIndex = task - 1;
                              } else {
                                // If it's a string, try to extract the number
                                const taskStr = String(task);
                                const taskMatch =
                                  taskStr.match(/Task (\d+)/i) || taskStr.match(/(\d+)/);
                                taskIndex = taskMatch ? parseInt(taskMatch[1]) - 1 : null;
                              }

                              const taskDescription =
                                taskIndex !== null &&
                                taskIndex >= 0 &&
                                testData?.testData?.tasks?.[taskIndex]
                                  ? testData.testData.tasks[taskIndex]
                                  : null;

                              // Display the task identifier
                              const displayText =
                                typeof task === "number" ? `Task ${task}` : String(task);

                              return (
                                <Tooltip key={idx}>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      {displayText}
                                    </Badge>
                                  </TooltipTrigger>
                                  {taskDescription && (
                                    <TooltipContent>
                                      <p className="max-w-xs">{taskDescription}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

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
                      <div className="relative">
                        <Textarea
                          placeholder="Add notes about this finding... (Press Cmd/Ctrl + Enter to save)"
                          className="min-h-20 pr-10"
                          value={finding.note}
                          onChange={(e) => handleNoteChange(finding.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              if (finding.hasUnsavedChanges) {
                                handleSaveValidation(finding);
                              }
                            }
                          }}
                        />
                        {finding.hasUnsavedChanges && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleSaveValidation(finding)}
                            title="Save changes (Cmd/Ctrl + Enter)"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {finding.hasUnsavedChanges && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Press Cmd/Ctrl + Enter to save, or click the save icon
                        </p>
                      )}
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
