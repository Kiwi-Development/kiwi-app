"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "../../../../components/app-layout";
import { StepIndicator } from "../../../../components/test-wizard/step-indicator";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { Badge } from "../../../../components/ui/badge";
import { Checkbox } from "../../../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { useToast } from "../../../../hooks/use-toast";
import { useRouter } from "next/navigation";
import { CheckCircle2, GripVertical, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { testStore, type Test } from "@/lib/stores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog";
import { personaStore, type Persona } from "@/lib/stores";

function NewTestPageContent() {
  const searchParams = useSearchParams();
  const testId = searchParams.get("id");
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [testName, setTestName] = useState("");
  const [goal, setGoal] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);

  const [mutation, setMutation] = useState([2]);
  const [prototypeType, setPrototypeType] = useState<"" | "live" | "figma">("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");

  const [tasks, setTasks] = useState<string[]>([]);
  const [heuristics, setHeuristics] = useState({
    visibility: true,
    realWorld: true,
    userControl: true,
    errorPrevention: true,
    recognition: true,
    consistency: true,
    a11y: true,
  });
  const [policyBanner, setPolicyBanner] = useState(true);
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaRole, setNewPersonaRole] = useState("");
  const [newPersonaTags, setNewPersonaTags] = useState<string[]>([]);
  const [newPersonaGoals, setNewPersonaGoals] = useState("");
  const [newPersonaBehaviors, setNewPersonaBehaviors] = useState("");
  const [newPersonaFrustrations, setNewPersonaFrustrations] = useState("");
  const [newPersonaConstraints, setNewPersonaConstraints] = useState("");
  const [newPersonaAccessibility, setNewPersonaAccessibility] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [runCount, setRunCount] = useState(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Load personas
  useEffect(() => {
    const loadPersonas = async () => {
      setLoadingPersonas(true);
      try {
        const loadedPersonas = await personaStore.getPersonas();
        setPersonas(loadedPersonas);
        console.log("Loaded personas:", loadedPersonas);
      } catch (error) {
        console.error("Error loading personas:", error);
      } finally {
        setLoadingPersonas(false);
      }
    };
    loadPersonas();
  }, []);

  // Load test data if editing
  useEffect(() => {
    const loadTestData = async () => {
      if (testId) {
        setIsEditing(true);
        try {
          const test = await testStore.getTestById(testId);
          if (test) {
            setTestName(test.title);
            setGoal(test.testData?.goal || "");
            setSelectedPersona(test.testData?.selectedPersona || "");
            setRunCount(
              (test.testData && "runCount" in test.testData
                ? (test.testData.runCount as number)
                : undefined) || 1
            );
            setTasks(test.testData?.tasks || []);
            setFigmaUrl(test.testData?.figmaUrlA || "");
            setLiveUrl(test.testData?.liveUrl || "");
            setPrototypeType(
              test.artifactType === "Figma"
                ? "figma"
                : test.artifactType === "Live URL"
                  ? "live"
                  : ""
            );
            if (test.heuristics) {
              setHeuristics({
                visibility: test.heuristics.visibility ?? true,
                realWorld: test.heuristics.realWorld ?? true,
                userControl: test.heuristics.userControl ?? true,
                errorPrevention: test.heuristics.errorPrevention ?? true,
                recognition: test.heuristics.recognition ?? true,
                consistency: test.heuristics.consistency ?? true,
                a11y: test.heuristics.a11y ?? true,
              });
            }
          }
        } catch (error) {
          console.error("Error loading test data:", error);
          toast({
            title: "Error",
            description: "Failed to load test data",
            variant: "destructive",
          });
        }
      }
    };
    loadTestData();
  }, [testId, toast]);

  // Task management state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);

  const availableTags = [
    "Non-technical",
    "Time-pressed",
    "Keyboard-friendly",
    "Mobile-first",
    "Accessibility needs",
    "Expert user",
    "First-time user",
    "Non-native English",
  ];

  const handleNext = () => {
    const newErrors: Record<string, boolean> = {};
    let isValid = true;

    if (currentStep === 1) {
      // Step 1: Basics - includes test name, goal, persona, and tasks
      if (!testName.trim()) {
        newErrors.testName = true;
        isValid = false;
      }
      if (!goal.trim()) {
        newErrors.goal = true;
        isValid = false;
      }
      if (!selectedPersona) {
        newErrors.selectedPersona = true;
        isValid = false;
      }
      if (tasks.length === 0) {
        newErrors.tasks = true;
        isValid = false;
      }
    } else if (currentStep === 2) {
      // Step 2: Upload Prototype
      if (!prototypeType) {
        newErrors.prototypeType = true;
        isValid = false;
      } else if (prototypeType === "figma" && !figmaUrl.trim()) {
        newErrors.figmaUrl = true;
        isValid = false;
      } else if (prototypeType === "live" && !liveUrl.trim()) {
        newErrors.liveUrl = true;
        isValid = false;
      }
    }

    setErrors(newErrors);

    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      // If on step 1, navigate back to tests page
      router.push("/dashboard/tests");
    }
  };

  const handleSavePersona = () => {
    if (!newPersonaName || !newPersonaRole) {
      toast({
        title: "Error",
        description: "Please fill in name and role",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Persona created",
      description: `${newPersonaName} has been added to your personas`,
    });

    setPersonaDialogOpen(false);
    setNewPersonaName("");
    setNewPersonaRole("");
    setNewPersonaTags([]);
    setNewPersonaGoals("");
    setNewPersonaBehaviors("");
    setNewPersonaFrustrations("");
    setNewPersonaConstraints("");
    setNewPersonaAccessibility("");
  };

  const selectPersona = (personaId: string) => {
    setSelectedPersona(personaId);
  };

  const toggleTag = (tag: string) => {
    setNewPersonaTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerateWithAI = async () => {
    if (!aiDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description of the persona",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPersona(true);
    try {
      const response = await fetch("/api/personas/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: aiDescription }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate persona");
      }

      const personaData = await response.json();

      // Populate form fields with AI-generated data
      setNewPersonaName(personaData.name || "");
      setNewPersonaRole(personaData.role || "");
      setNewPersonaTags(personaData.tags || []);
      setNewPersonaGoals(personaData.goals?.join("\n") || "");
      setNewPersonaBehaviors(personaData.behaviors?.join("\n") || "");
      setNewPersonaFrustrations(personaData.frustrations?.join("\n") || "");
      setNewPersonaConstraints(personaData.constraints?.join("\n") || "");
      setNewPersonaAccessibility(personaData.accessibility?.join("\n") || "");

      // Hide AI input and show success
      setShowAiInput(false);
      setAiDescription("");
      toast({
        title: "Persona generated",
        description: "AI has filled in the persona details. You can edit them before saving.",
      });
    } catch (error) {
      console.error("Error generating persona:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate persona",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPersona(false);
    }
  };

  const handleAddTask = () => {
    if (!newTaskContent.trim()) return;
    setTasks([...tasks, newTaskContent]);
    setNewTaskContent("");
    setTaskDialogOpen(false);
  };

  const handleDeleteTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  const handleDragStart = (index: number) => {
    setDraggedTaskIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTaskIndex === null || draggedTaskIndex === index) return;

    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedTaskIndex];
    newTasks.splice(draggedTaskIndex, 1);
    newTasks.splice(index, 0, draggedTask);

    setTasks(newTasks);
    setDraggedTaskIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedTaskIndex(null);
  };

  const handleSaveDraft = async () => {
    if (!testName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a test name",
        variant: "destructive",
      });
      return;
    }

    const persona = personas.find((p) => p.id === selectedPersona);
    const testToSave = {
      id: testId || "", // Use existing ID if editing, otherwise will be generated
      title: testName,
      status: "draft" as const,
      lastRun: "Never",
      personas: persona ? [`${persona.name} / ${persona.role}`] : [],
      artifactType: prototypeType === "figma" ? "Figma" : "Live URL",
      createdAt: Date.now(),
      testData: {
        testName,
        goal,
        selectedPersona,
        runCount,
        tasks,
        figmaUrlA: figmaUrl,
        liveUrl,
      },
      heuristics,
    };

    const savedTest = await testStore.saveTest(testToSave);
    if (!savedTest) {
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: isEditing ? "Draft updated" : "Draft saved",
      description: isEditing ? "Your test has been updated" : "Your test has been saved as a draft",
    });

    // Navigate to tests page to see the saved draft
    router.push("/dashboard/tests");
  };

  const handleRunSimulation = async () => {
    // Validate required fields
    if (!testName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a test name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPersona) {
      toast({
        title: "Error",
        description: "Please select a persona",
        variant: "destructive",
      });
      return;
    }

    if (tasks.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one task",
        variant: "destructive",
      });
      return;
    }

    if (!prototypeType || (prototypeType === "figma" && !figmaUrl.trim()) || (prototypeType === "live" && !liveUrl.trim())) {
      toast({
        title: "Error",
        description: "Please provide a prototype URL",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Save the test first
      const persona = personas.find((p) => p.id === selectedPersona);
      const newTest = {
        id: testId || "", // Use existing ID if editing, otherwise will be generated
        title: testName,
        status: "draft" as const, // Save as draft initially
        lastRun: "Never",
        personas: persona ? [`${persona.name} / ${persona.role}`] : [],
        artifactType: prototypeType === "figma" ? "Figma" : "Live URL",
        createdAt: Date.now(),
        testData: {
          testName,
          goal,
          selectedPersona,
          runCount,
          tasks,
          figmaUrlA: figmaUrl,
          liveUrl,
        },
        heuristics,
      };

      const savedTest = await testStore.saveTest(newTest);
      if (!savedTest || !savedTest.id) {
        toast({
          title: "Error",
          description: "Failed to save test or test ID is missing",
          variant: "destructive",
        });
        console.error("Saved test:", savedTest);
        return;
      }

      // Validate test ID is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(savedTest.id)) {
        toast({
          title: "Error",
          description: `Invalid test ID: ${savedTest.id}. Please try saving the test again.`,
          variant: "destructive",
        });
        console.error("Invalid test ID format:", savedTest.id);
        return;
      }

      console.log("Saved test ID:", savedTest.id);

      // 2. Generate temporary ID and navigate IMMEDIATELY (optimistic navigation)
      // We'll update the URL once we get the real testRunId
      const tempTestRunId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log("Navigating immediately with temp ID:", tempTestRunId);
      
      // Store testId in sessionStorage so the runs page can load test data immediately
      sessionStorage.setItem(`testRun_${tempTestRunId}`, savedTest.id);
      
      // Navigate IMMEDIATELY - don't wait for anything
      router.push(`/dashboard/runs/${tempTestRunId}?testId=${savedTest.id}`);

      // 3. Create test run in the background and update URL once we have real ID
      const requestBody = { testId: savedTest.id };
      console.log("Creating test run with body:", requestBody);

      fetch("/api/test-runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            console.error("Failed to start test run:", errorData);
            toast({
              title: "Error",
              description: errorData.error || "Failed to start test run",
              variant: "destructive",
            });
            // Navigate back to tests page on error
            router.push("/dashboard/tests");
            return;
          }

          const data = await response.json();
          const testRunId = data.testRunId;

          if (testRunId && testRunId !== tempTestRunId) {
            // Replace the URL with the real testRunId
            console.log("Updating URL with real test run ID:", testRunId);
            router.replace(`/dashboard/runs/${testRunId}`);
          }
        })
        .catch((error) => {
          console.error("Error starting test run:", error);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to start test run",
            variant: "destructive",
          });
          // Navigate back to tests page on error
          router.push("/dashboard/tests");
        });
    } catch (error) {
      console.error("Error starting test run:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start test run. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getMutationDescription = (level: number) => {
    const descriptions = [
      "Baseline behavior - follows expected patterns",
      "Minor variations - occasional unexpected actions",
      "Moderate exploration - tests edge cases and alternatives",
      "High variance - explores multiple paths and failure modes",
    ];
    return descriptions[level] || descriptions[0];
  };

  return (
    <AppLayout>
      <StepIndicator currentStep={currentStep} />

      <main className="container mx-auto p-6 max-w-4xl">
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Basics</CardTitle>
                <CardDescription>
                  Set up the fundamental details of your usability test
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="testName">Test Name *</Label>
                  <Input
                    id="testName"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g., Evaluations Page Design B"
                    className={errors.testName ? "border-red-500" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">Goal *</Label>
                  <Textarea
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="What decision will this inform?"
                    className={`min-h-24 ${errors.goal ? "border-red-500" : ""}`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Persona & Use Case</CardTitle>
                <CardDescription>Select a persona and define the use case to test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Persona *</Label>
                  <div
                    className={`space-y-2 ${errors.selectedPersona ? "border border-red-500 rounded-lg p-2" : ""}`}
                  >
                    {loadingPersonas ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        Loading personas...
                      </div>
                    ) : personas.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg p-4">
                        No personas available. Create one first.
                      </div>
                    ) : (
                      personas.map((persona) => (
                        <div
                          key={persona.id}
                          className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedPersona === persona.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-accent/50"
                          }`}
                          onClick={() => selectPersona(persona.id)}
                        >
                          <div
                            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                              selectedPersona === persona.id ? "border-primary" : "border-input"
                            }`}
                          >
                            {selectedPersona === persona.id && (
                              <div className="h-3 w-3 rounded-full bg-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{persona.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {persona.role} • {persona.tags.join(" • ")}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-transparent"
                    onClick={() => setPersonaDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Persona
                    <Sparkles className="h-4 w-4 ml-2 text-primary" />
                  </Button>
                </div>

                {selectedPersona && (
                  <div className="space-y-2">
                    <Label>Number of runs</Label>
                    <Select
                      value={runCount.toString()}
                      onValueChange={(v) => setRunCount(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? "run" : "runs"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Each run will be different as the agent behavior varies
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Persona Variants</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Novice</Badge>
                    <Badge variant="secondary">Time-pressed</Badge>
                    <Badge variant="secondary">Non-native English</Badge>
                    <Badge variant="secondary">Keyboard-only</Badge>
                  </div>
                </div>
              </CardContent>
              <Dialog open={personaDialogOpen} onOpenChange={setPersonaDialogOpen}>
                <DialogContent className="sm:max-w-[525px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Persona</DialogTitle>
                    <DialogDescription>
                      Add a new user persona for testing. Personas help simulate different user
                      behaviors.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* AI Generation Section */}
                    <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium">
                            Generate with AI
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAiInput(!showAiInput);
                            if (showAiInput) {
                              setAiDescription("");
                            }
                          }}
                        >
                          {showAiInput ? "Cancel" : "Try AI"}
                        </Button>
                      </div>
                      {showAiInput && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Describe your persona in natural language... e.g., 'A busy marketing manager in their 30s who needs to quickly book flights for business trips. They're price-conscious, use mobile devices frequently, and get frustrated by hidden fees.'"
                            value={aiDescription}
                            onChange={(e) => setAiDescription(e.target.value)}
                            className="min-h-[100px]"
                            disabled={isGeneratingPersona}
                          />
                          <Button
                            onClick={handleGenerateWithAI}
                            disabled={isGeneratingPersona || !aiDescription.trim()}
                            className="w-full"
                          >
                            {isGeneratingPersona ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Persona
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="persona-name">Name *</Label>
                      <Input
                        id="persona-name"
                        value={newPersonaName}
                        onChange={(e) => setNewPersonaName(e.target.value)}
                        placeholder="e.g., Alex Chen"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="persona-role">Role *</Label>
                      <Input
                        id="persona-role"
                        value={newPersonaRole}
                        onChange={(e) => setNewPersonaRole(e.target.value)}
                        placeholder="e.g., Marketing Manager"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={newPersonaTags.includes(tag) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Click tags to select/deselect</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="persona-goals">Goals</Label>
                        <Textarea
                          id="persona-goals"
                          value={newPersonaGoals}
                          onChange={(e) => setNewPersonaGoals(e.target.value)}
                          placeholder="e.g., Book a flight for under $300"
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="persona-behaviors">Behaviors</Label>
                        <Textarea
                          id="persona-behaviors"
                          value={newPersonaBehaviors}
                          onChange={(e) => setNewPersonaBehaviors(e.target.value)}
                          placeholder="e.g., Price compares across multiple tabs"
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="persona-frustrations">Frustrations</Label>
                        <Textarea
                          id="persona-frustrations"
                          value={newPersonaFrustrations}
                          onChange={(e) => setNewPersonaFrustrations(e.target.value)}
                          placeholder="e.g., Hidden fees at checkout"
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="persona-constraints">Constraints</Label>
                        <Textarea
                          id="persona-constraints"
                          value={newPersonaConstraints}
                          onChange={(e) => setNewPersonaConstraints(e.target.value)}
                          placeholder="e.g., Only has 15 minutes during lunch break"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="persona-accessibility">Accessibility Needs</Label>
                      <Textarea
                        id="persona-accessibility"
                        value={newPersonaAccessibility}
                        onChange={(e) => setNewPersonaAccessibility(e.target.value)}
                        placeholder="One need per line"
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPersonaDialogOpen(false);
                        setNewPersonaName("");
                        setNewPersonaRole("");
                        setNewPersonaTags([]);
                        setNewPersonaGoals("");
                        setNewPersonaBehaviors("");
                        setNewPersonaFrustrations("");
                        setNewPersonaConstraints("");
                        setNewPersonaAccessibility("");
                        setAiDescription("");
                        setShowAiInput(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!newPersonaName || !newPersonaRole) {
                          toast({
                            title: "Error",
                            description: "Please fill in name and role",
                            variant: "destructive",
                          });
                          return;
                        }

                        const newPersona = await personaStore.addPersona({
                          name: newPersonaName,
                          role: newPersonaRole,
                          tags: newPersonaTags,
                          goals: newPersonaGoals.split("\n").filter(Boolean),
                          behaviors: newPersonaBehaviors.split("\n").filter(Boolean),
                          frustrations: newPersonaFrustrations.split("\n").filter(Boolean),
                          constraints: newPersonaConstraints.split("\n").filter(Boolean),
                          accessibility: newPersonaAccessibility.split("\n").filter(Boolean),
                        });

                        if (newPersona) {
                          const allPersonas = await personaStore.getPersonas();
                          setPersonas(allPersonas);
                          setSelectedPersona(newPersona.id);
                          setPersonaDialogOpen(false);
                          setNewPersonaName("");
                          setNewPersonaRole("");
                          setNewPersonaTags([]);
                          setNewPersonaGoals("");
                          setNewPersonaBehaviors("");
                          setNewPersonaFrustrations("");
                          setNewPersonaConstraints("");
                          setNewPersonaAccessibility("");
                          setAiDescription("");
                          setShowAiInput(false);
                          toast({
                            title: "Persona created",
                            description: `${newPersonaName} has been added`,
                          });
                        } else {
                          toast({
                            title: "Error",
                            description: "Failed to create persona",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Create Persona
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks *</CardTitle>
                <CardDescription>Define the tasks users should complete</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.map((task, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-border group bg-background ${
                      draggedTaskIndex === index ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="cursor-grab active:cursor-grabbing mt-1">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Task {index + 1}</p>
                      <p className="text-sm text-muted-foreground">{task}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
                      onClick={() => handleDeleteTask(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full bg-transparent ${errors.tasks ? "border-red-500" : ""}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
                      <DialogDescription>
                        Describe the task you want the persona to perform.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-content">Task Description</Label>
                        <Textarea
                          id="task-content"
                          value={newTaskContent}
                          onChange={(e) => setNewTaskContent(e.target.value)}
                          placeholder="e.g., Find the cheapest flight to London"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddTask}>Add Task</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Heuristic Evaluation</CardTitle>
                <CardDescription>Select which heuristics to evaluate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="visibility" className="flex-1 cursor-pointer">
                    Visibility of system status
                  </Label>
                  <Checkbox
                    id="visibility"
                    checked={heuristics.visibility}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, visibility: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="realWorld" className="flex-1 cursor-pointer">
                    Match between system and real world
                  </Label>
                  <Checkbox
                    id="realWorld"
                    checked={heuristics.realWorld}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, realWorld: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="userControl" className="flex-1 cursor-pointer">
                    User control and freedom
                  </Label>
                  <Checkbox
                    id="userControl"
                    checked={heuristics.userControl}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, userControl: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="errorPrevention" className="flex-1 cursor-pointer">
                    Error prevention
                  </Label>
                  <Checkbox
                    id="errorPrevention"
                    checked={heuristics.errorPrevention}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, errorPrevention: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="recognition" className="flex-1 cursor-pointer">
                    Recognition over recall
                  </Label>
                  <Checkbox
                    id="recognition"
                    checked={heuristics.recognition}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, recognition: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="consistency" className="flex-1 cursor-pointer">
                    Consistency and standards
                  </Label>
                  <Checkbox
                    id="consistency"
                    checked={heuristics.consistency}
                    onCheckedChange={(checked) =>
                      setHeuristics({ ...heuristics, consistency: !!checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="a11y" className="flex-1 cursor-pointer">
                    Quick accessibility scan
                  </Label>
                  <Checkbox
                    id="a11y"
                    checked={heuristics.a11y}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, a11y: !!checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Prototype</CardTitle>
              <CardDescription>Add a prototype to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!prototypeType && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose how you&apos;d like to add your prototype *
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button
                      variant="outline"
                      className={`h-24 flex flex-col gap-2 bg-transparent ${errors.prototypeType ? "border-red-500" : ""}`}
                      onClick={() => setPrototypeType("live")}
                    >
                      <span className="font-semibold">Live URL</span>
                      <span className="text-xs text-muted-foreground">Test a deployed website</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-24 flex flex-col gap-2 bg-transparent ${errors.prototypeType ? "border-red-500" : ""}`}
                      onClick={() => setPrototypeType("figma")}
                    >
                      <span className="font-semibold">Figma</span>
                      <span className="text-xs text-muted-foreground">Import Figma prototype</span>
                    </Button>
                  </div>
                </div>
              )}

              {prototypeType === "figma" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Figma Prototype</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPrototypeType("");
                        setFigmaUrl("");
                        setFigmaUrl("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="figmaUrl">Figma Prototype URL *</Label>
                    <Input
                      id="figmaUrl"
                      value={figmaUrl}
                      onChange={(e) => {
                        const url = e.target.value.replace("&show-proto-sidebar=1", "");
                        setFigmaUrl(url);
                      }}
                      placeholder="https://www.figma.com/proto/..."
                      className={errors.figmaUrl ? "border-red-500" : ""}
                    />
                  </div>
                </div>
              )}

              {prototypeType === "live" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Live URL</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPrototypeType("");
                        setLiveUrl("");
                        setLiveUrl("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="liveUrl">Website URL *</Label>
                    <Input
                      id="liveUrl"
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                      placeholder="https://example.com"
                      className={errors.liveUrl ? "border-red-500" : ""}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Run</CardTitle>
              <CardDescription>Confirm your test configuration before running</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Test Details</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{testName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Goal:</span>
                      <span className="font-medium text-right max-w-[60%]">{goal}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Personas</h4>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedPersona ? (
                        (() => {
                          const persona = personas.find((p) => p.id === selectedPersona);
                          return persona ? (
                            <Badge key={persona.id} variant="secondary">
                              {persona.name} / {persona.role}
                            </Badge>
                          ) : null;
                        })()
                      ) : (
                        <span className="text-sm text-muted-foreground">No persona selected</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Prototype</h4>
                  <div className="space-y-1.5 text-sm">
                    {(figmaUrl || liveUrl) && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-muted-foreground">
                          {prototypeType === "figma" ? "Figma prototype" : "Live URL"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Tasks</h4>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {tasks.map((task, index) => (
                      <div key={index}>• {task}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Heuristics</h4>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {Object.entries(heuristics)
                      .filter(([_, enabled]) => enabled)
                      .map(([key]) => {
                        const labels: Record<string, string> = {
                          visibility: "Visibility of system status",
                          realWorld: "Match between system and real world",
                          userControl: "User control and freedom",
                          errorPrevention: "Error prevention",
                          recognition: "Recognition over recall",
                          consistency: "Consistency and standards",
                          a11y: "Quick accessibility scan",
                        };
                        return <div key={key}>• {labels[key]}</div>;
                      })}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Configuration</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max depth:</span>
                      <span className="font-medium">30 actions</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleRunSimulation} size="lg" className="flex-1">
                  Run Simulation
                </Button>
                <Button variant="outline" size="lg" onClick={handleSaveDraft}>
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between pt-6">
          <Button onClick={handleBack} variant="outline">
            Back
          </Button>
          {currentStep < 3 && <Button onClick={handleNext}>Next</Button>}
        </div>
      </main>
    </AppLayout>
  );
}

export default function NewTestPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-center h-64">
              <p>Loading...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <NewTestPageContent />
    </Suspense>
  );
}
