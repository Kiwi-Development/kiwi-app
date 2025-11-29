"use client"

import { useState } from "react"
import { AppLayout } from "../../../../components/app-layout"
import { StepIndicator } from "../../../../components/test-wizard/step-indicator"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Textarea } from "../../../../components/ui/textarea"
import { Badge } from "../../../../components/ui/badge"
import { Checkbox } from "../../../../components/ui/checkbox"
import { useToast } from "../../../../../hooks/use-toast"
import { useRouter } from "next/navigation"
import { CheckCircle2, GripVertical, Plus, Trash2 } from "lucide-react"
import { testStore } from "../../../../lib/test-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog"
import { personaStore, type Persona } from "../../../../lib/persona-store"

export default function NewTestPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [testName, setTestName] = useState("")
  const [goal, setGoal] = useState("")

  const [useCase, setUseCase] = useState("")
  const [mutation, setMutation] = useState([2])
  const [prototypeType, setPrototypeType] = useState<"" | "live" | "figma">("")
  const [figmaUrl, setFigmaUrl] = useState("")
  const [liveUrl, setLiveUrl] = useState("")

  const [tasks, setTasks] = useState<string[]>([])
  const [heuristics, setHeuristics] = useState({
    visibility: true,
    realWorld: true,
    userControl: true,
    errorPrevention: true,
    recognition: true,
    consistency: true,
    a11y: true,
  })
  const [policyBanner, setPolicyBanner] = useState(true)
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState("")
  const [newPersonaRole, setNewPersonaRole] = useState("")
  const [newPersonaTags, setNewPersonaTags] = useState<string[]>([])
  const [newPersonaGoals, setNewPersonaGoals] = useState("")
  const [newPersonaBehaviors, setNewPersonaBehaviors] = useState("")
  const [newPersonaFrustrations, setNewPersonaFrustrations] = useState("")
  const [newPersonaConstraints, setNewPersonaConstraints] = useState("")
  const [newPersonaAccessibility, setNewPersonaAccessibility] = useState("")
  const { toast } = useToast()
  const router = useRouter()
  const [selectedPersona, setSelectedPersona] = useState<string>("")
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  // Task management state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [newTaskContent, setNewTaskContent] = useState("")
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null)

  const availableTags = [
    "Non-technical",
    "Time-pressed",
    "Keyboard-friendly",
    "Mobile-first",
    "Accessibility needs",
    "Expert user",
    "First-time user",
    "Non-native English",
  ]



  const handleNext = () => {
    const newErrors: Record<string, boolean> = {}
    let isValid = true

    if (currentStep === 1) {
      if (!testName.trim()) {
        newErrors.testName = true
        isValid = false
      }
      if (!goal.trim()) {
        newErrors.goal = true
        isValid = false
      }
    } else if (currentStep === 2) {
      if (!selectedPersona) {
        newErrors.selectedPersona = true
        isValid = false
      }
      if (!useCase.trim()) {
        newErrors.useCase = true
        isValid = false
      }
    } else if (currentStep === 3) {
      if (!prototypeType) {
        newErrors.prototypeType = true
        isValid = false
      } else if (prototypeType === "figma" && !figmaUrl.trim()) {
        newErrors.figmaUrl = true
        isValid = false
      } else if (prototypeType === "live" && !liveUrl.trim()) {
        newErrors.liveUrl = true
        isValid = false
      }
    } else if (currentStep === 4) {
      if (tasks.length === 0) {
        newErrors.tasks = true
        isValid = false
      }
    }

    setErrors(newErrors)

    if (isValid && currentStep < 5) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSavePersona = () => {
    if (!newPersonaName || !newPersonaRole) {
      toast({
        title: "Error",
        description: "Please fill in name and role",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Persona created",
      description: `${newPersonaName} has been added to your personas`,
    })

    setPersonaDialogOpen(false)
    setNewPersonaName("")
    setNewPersonaRole("")
    setNewPersonaTags([])
    setNewPersonaGoals("")
    setNewPersonaBehaviors("")
    setNewPersonaFrustrations("")
    setNewPersonaConstraints("")
    setNewPersonaAccessibility("")
  }

  const selectPersona = (personaId: string) => {
    setSelectedPersona(personaId)
  }

  const toggleTag = (tag: string) => {
    setNewPersonaTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleAddTask = () => {
    if (!newTaskContent.trim()) return
    setTasks([...tasks, newTaskContent])
    setNewTaskContent("")
    setTaskDialogOpen(false)
  }

  const handleDeleteTask = (index: number) => {
    const newTasks = [...tasks]
    newTasks.splice(index, 1)
    setTasks(newTasks)
  }

  const handleDragStart = (index: number) => {
    setDraggedTaskIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedTaskIndex === null || draggedTaskIndex === index) return

    const newTasks = [...tasks]
    const draggedTask = newTasks[draggedTaskIndex]
    newTasks.splice(draggedTaskIndex, 1)
    newTasks.splice(index, 0, draggedTask)

    setTasks(newTasks)
    setDraggedTaskIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedTaskIndex(null)
  }

  const handleRunSimulation = () => {
    //   if (selectedPersonas.length === 0) {
    //     toast({
    //       title: "Error",
    //       description: "Please select at least one persona",
    //       variant: "destructive",
    //     })
    //     return
    //   }

    // const selectedPersonaDetails = personaStore.getPersonas()
    //   .filter(p => selectedPersonas.includes(p.id))
    //   .map(p => p.name)

    //   if (selectedPersonaDetails.length === 0) {
    //     toast({
    //       title: "Error",
    //       description: "No valid personas selected",
    //       variant: "destructive",
    //     })
    //     return
    //   }

    const newTest = {
      id: Date.now().toString(),
      title: testName,
      status: "running" as const,
      lastRun: "Just now",
      personas: selectedPersona ? (() => {
        const persona = personaStore.getPersonas().find(p => p.id === selectedPersona)
        return persona ? [`${persona.name} / ${persona.role}`] : []
      })() : [],
      artifactType: prototypeType === "figma" ? "Figma" : "Live URL",
      createdAt: Date.now(),
      testData: {
        testName,
        goal,
        selectedPersona,
        useCase,
        tasks,
        figmaUrlA: figmaUrl,
        liveUrl,
      },
    }

    testStore.saveTest(newTest)

    toast({
      title: "Simulation started",
      description: "Running test with 3 persona variants",
    })
    router.push(`/dashboard/runs/${newTest.id}`)
  }

  const getMutationDescription = (level: number) => {
    const descriptions = [
      "Baseline behavior - follows expected patterns",
      "Minor variations - occasional unexpected actions",
      "Moderate exploration - tests edge cases and alternatives",
      "High variance - explores multiple paths and failure modes",
    ]
    return descriptions[level] || descriptions[0]
  }

  return (
    <AppLayout>
      <StepIndicator currentStep={currentStep} />

      <main className="container mx-auto p-6 max-w-4xl">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Basics</CardTitle>
              <CardDescription>Set up the fundamental details of your usability test</CardDescription>
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
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Persona & Use Case</CardTitle>
                <CardDescription>Select a persona and define the use case to test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Select Persona *</Label>
                  <div className={`space-y-2 ${errors.selectedPersona ? "border border-red-500 rounded-lg p-2" : ""}`}>
                    {personaStore.getPersonas().map((persona) => (
                      <div
                        key={persona.id}
                        className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedPersona === persona.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-accent/50'
                          }`}
                        onClick={() => selectPersona(persona.id)}
                      >
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedPersona === persona.id ? 'border-primary' : 'border-input'
                          }`}>
                          {selectedPersona === persona.id && (
                            <div className="h-3 w-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{persona.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {persona.role} • {persona.tags.join(' • ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 bg-transparent"
                    onClick={() => setPersonaDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Persona
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="useCase">Use Case *</Label>
                  <Textarea
                    id="useCase"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    placeholder="Test the usability of the evaluation models interface for comparing AI outputs"
                    className={`min-h-24 ${errors.useCase ? "border-red-500" : ""}`}
                  />
                </div>

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
                      Add a new user persona for testing. Personas help simulate different user behaviors.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
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
                    <Button variant="outline" onClick={() => {
                      setPersonaDialogOpen(false)
                      setNewPersonaName("")
                      setNewPersonaRole("")
                      setNewPersonaTags([])
                      setNewPersonaGoals("")
                      setNewPersonaBehaviors("")
                      setNewPersonaFrustrations("")
                      setNewPersonaConstraints("")
                      setNewPersonaAccessibility("")
                    }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (!newPersonaName || !newPersonaRole) {
                          toast({
                            title: "Error",
                            description: "Please fill in name and role",
                            variant: "destructive",
                          })
                          return
                        }

                        const newPersona = personaStore.addPersona({
                          name: newPersonaName,
                          role: newPersonaRole,
                          tags: newPersonaTags,
                          goals: newPersonaGoals.split('\n').filter(Boolean),
                          behaviors: newPersonaBehaviors.split('\n').filter(Boolean),
                          frustrations: newPersonaFrustrations.split('\n').filter(Boolean),
                          constraints: newPersonaConstraints.split('\n').filter(Boolean),
                          accessibility: newPersonaAccessibility.split('\n').filter(Boolean),
                        })

                        setSelectedPersona(newPersona.id)
                        setPersonaDialogOpen(false)
                        setNewPersonaName("")
                        setNewPersonaRole("")
                        setNewPersonaTags([])
                        setNewPersonaGoals("")
                        setNewPersonaBehaviors("")
                        setNewPersonaFrustrations("")
                        setNewPersonaConstraints("")
                        setNewPersonaAccessibility("")
                      }}
                    >
                      Create Persona
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Prototype</CardTitle>
              <CardDescription>Add a prototype to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!prototypeType && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Choose how you'd like to add your prototype *</p>
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
                        setPrototypeType("")
                        setFigmaUrl("")
                        setFigmaUrl("")
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
                        const url = e.target.value.replace("&show-proto-sidebar=1", "")
                        setFigmaUrl(url)
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
                        setPrototypeType("")
                        setLiveUrl("")
                        setLiveUrl("")
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

        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasks *</CardTitle>
                <CardDescription>Define the tasks users should complete</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.map((task, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-border group bg-background ${draggedTaskIndex === index ? 'opacity-50' : ''
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
                    <Button variant="outline" size="sm" className={`w-full bg-transparent ${errors.tasks ? "border-red-500" : ""}`}>
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
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, visibility: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="realWorld" className="flex-1 cursor-pointer">
                    Match between system and real world
                  </Label>
                  <Checkbox
                    id="realWorld"
                    checked={heuristics.realWorld}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, realWorld: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="userControl" className="flex-1 cursor-pointer">
                    User control and freedom
                  </Label>
                  <Checkbox
                    id="userControl"
                    checked={heuristics.userControl}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, userControl: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="errorPrevention" className="flex-1 cursor-pointer">
                    Error prevention
                  </Label>
                  <Checkbox
                    id="errorPrevention"
                    checked={heuristics.errorPrevention}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, errorPrevention: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="recognition" className="flex-1 cursor-pointer">
                    Recognition over recall
                  </Label>
                  <Checkbox
                    id="recognition"
                    checked={heuristics.recognition}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, recognition: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="consistency" className="flex-1 cursor-pointer">
                    Consistency and standards
                  </Label>
                  <Checkbox
                    id="consistency"
                    checked={heuristics.consistency}
                    onCheckedChange={(checked) => setHeuristics({ ...heuristics, consistency: !!checked })}
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

        {currentStep === 5 && (
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
                      {selectedPersona ? (() => {
                        const persona = personaStore.getPersonas().find(p => p.id === selectedPersona)
                        return persona ? (
                          <Badge key={persona.id} variant="secondary">
                            {persona.name} / {persona.role}
                          </Badge>
                        ) : null
                      })() : (
                        <span className="text-sm text-muted-foreground">No persona selected</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground block mb-1">Use Case: {useCase}</span>
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
                        }
                        return <div key={key}>• {labels[key]}</div>
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
                <Button variant="outline" size="lg">
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between pt-6">
          <Button onClick={handleBack} variant="outline" disabled={currentStep === 1}>
            Back
          </Button>
          {currentStep < 5 && <Button onClick={handleNext}>Next</Button>}
        </div>
      </main>
    </AppLayout>
  )
}
