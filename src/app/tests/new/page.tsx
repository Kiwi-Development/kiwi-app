"use client"

import { useState } from "react"
import { AppLayout } from "../../../../components/app-layout"
import { StepIndicator } from "../../../../components/test-wizard/step-indicator"
import { Button } from "../../../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Textarea } from "../../../../components/ui/textarea"
import { Switch } from "../../../../components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select"
import { Badge } from "../../../../components/ui/badge"
import { Slider } from "../../../../components/ui/slider"
import { Checkbox } from "../../../../components/ui/checkbox"
import { useToast } from "../../../../hooks/use-toast"
import { useRouter } from "next/navigation"
import { CheckCircle2, GripVertical, Plus } from "lucide-react"
import { testStore } from "../../../../lib/test-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog"
import { Progress } from "../../../../components/ui/progress"
import { personaStore, type Persona } from "../../../../lib/persona-store"

export default function NewTestPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [testName, setTestName] = useState("Evaluations Page Design B")
  const [goal, setGoal] = useState("")
  const [environment, setEnvironment] = useState("staging")
  const [piiRedaction, setPiiRedaction] = useState(true)
  const [selectedPersona, setSelectedPersona] = useState("jenny-park")
  const [useCase, setUseCase] = useState(
    "Test the usability of the evaluation models interface for comparing AI outputs.",
  )
  const [mutation, setMutation] = useState([2])
  const [prototypeType, setPrototypeType] = useState<"" | "live" | "figma">("")
  const [figmaUrl, setFigmaUrl] = useState("")
  const [liveUrl, setLiveUrl] = useState("")
  const [validated, setValidated] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationProgress, setValidationProgress] = useState(0)
  const [tasks, setTasks] = useState([
    "Switch the grid view from 1x3 to 2x4 layout",
    "Select and compare GPT-4 and Claude Sonnet models",
    "Export comparison results as PDF",
  ])
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
  const { toast } = useToast()
  const router = useRouter()
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([])

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

  const handleValidate = () => {
    setValidating(true)
    setValidationProgress(0)

    const interval = setInterval(() => {
      setValidationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setValidating(false)
          setValidated(true)
          toast({
            title: "Validation successful",
            description: "Detected 8 screens and 24 interactive elements",
          })
          return 100
        }
        return prev + 10
      })
    }, 150)
  }

  const handleNext = () => {
    if (currentStep < 5) {
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
  }

  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev => 
      prev.includes(personaId)
        ? prev.filter(id => id !== personaId)
        : [...prev, personaId]
    )
  }

  const toggleTag = (tag: string) => {
    setNewPersonaTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
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
      personas: ["Jenny / Novice", "Jenny / Time-pressed", "Jenny / Keyboard-only"],
      artifactType: "Figma",
      createdAt: Date.now(),
      testData: {
        testName,
        goal,
        environment,
        piiRedaction,
        selectedPersona,
        useCase,
        tasks,
        figmaUrl,
        liveUrl,
      },
    }

    testStore.saveTest(newTest)

    toast({
      title: "Simulation started",
      description: "Running test with 3 persona variants",
    })
    router.push(`/runs/${newTest.id}`)
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Goal *</Label>
                <Textarea
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="What decision will this inform?"
                  className="min-h-24"
                />
                <p className="text-xs text-muted-foreground">What decision will this inform?</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pii">PII Redaction</Label>
                  <p className="text-sm text-muted-foreground">Automatically redact personal information</p>
                </div>
                <Switch id="pii" checked={piiRedaction} onCheckedChange={setPiiRedaction} />
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
                  <Label>Select Personas *</Label>
                  <div className="space-y-2">
                    {personaStore.getPersonas().map((persona) => (
                      <div 
                        key={persona.id}
                        className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedPersonas.includes(persona.id)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => togglePersona(persona.id)}
                      >
                        <Checkbox 
                          checked={selectedPersonas.includes(persona.id)} 
                          onCheckedChange={() => togglePersona(persona.id)}
                          className="h-5 w-5"
                        />
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
                    className="min-h-24"
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Mutation Level</Label>
                    <span className="text-sm font-medium text-muted-foreground">{mutation[0]}</span>
                  </div>
                  <Slider value={mutation} onValueChange={setMutation} max={3} step={1} className="w-full" />
                  <p className="text-xs text-muted-foreground">{getMutationDescription(mutation[0])}</p>
                  <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="text-center">
                      0<br />
                      Baseline
                    </div>
                    <div className="text-center">
                      1<br />
                      Minor
                    </div>
                    <div className="text-center">
                      2<br />
                      Moderate
                    </div>
                    <div className="text-center">
                      3<br />
                      High
                    </div>
                  </div>
                </div>
              </CardContent>
              <Dialog open={personaDialogOpen} onOpenChange={setPersonaDialogOpen}>
              <DialogContent className="sm:max-w-[525px]">
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
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => {
                    setPersonaDialogOpen(false)
                    setNewPersonaName("")
                    setNewPersonaRole("")
                    setNewPersonaTags([])
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
                      })
                      
                      setSelectedPersonas(prev => [...prev, newPersona.id])
                      setPersonaDialogOpen(false)
                      setNewPersonaName("")
                      setNewPersonaRole("")
                      setNewPersonaTags([])
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
                <CardTitle>Persona Variance Preview</CardTitle>
                <CardDescription>Generated variants with behavioral agreement scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Jenny / Novice</span>
                    <Badge variant="outline">87% agreement</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Jenny / Time-pressed</span>
                    <Badge variant="outline">82% agreement</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Jenny / Keyboard-only</span>
                    <Badge variant="outline">91% agreement</Badge>
                  </div>
                </div>
              </CardContent>
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
                  <p className="text-sm text-muted-foreground">Choose how you'd like to add your prototype:</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
                      onClick={() => setPrototypeType("live")}
                    >
                      <span className="font-semibold">Live URL</span>
                      <span className="text-xs text-muted-foreground">Test a deployed website</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
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
                        setValidated(false)
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
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      placeholder="https://www.figma.com/proto/..."
                    />
                  </div>

                  {figmaUrl && !validated && !validating && (
                    <Button onClick={handleValidate} className="w-full">
                      Validate
                    </Button>
                  )}

                  {validating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Validating prototype...</span>
                        <span className="font-medium">{validationProgress}%</span>
                      </div>
                      <Progress value={validationProgress} className="h-2" />
                    </div>
                  )}

                  {validated && (
                    <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">Validation successful</p>
                            <p className="text-sm text-muted-foreground">
                              Detected 8 screens and 24 interactive elements
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="bg-background">
                          Inspect
                        </Button>
                      </div>
                    </div>
                  )}
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
                        setValidated(false)
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
                    />
                  </div>

                  {liveUrl && !validated && !validating && (
                    <Button onClick={handleValidate} className="w-full">
                      Validate
                    </Button>
                  )}

                  {validating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Validating website...</span>
                        <span className="font-medium">{validationProgress}%</span>
                      </div>
                      <Progress value={validationProgress} className="h-2" />
                    </div>
                  )}

                  {validated && (
                    <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">Validation successful</p>
                            <p className="text-sm text-muted-foreground">
                              Detected 8 screens and 24 interactive elements
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="bg-background">
                          Inspect
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Define the tasks users should complete</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Task {index + 1}</p>
                      <p className="text-sm text-muted-foreground">{task}</p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
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

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center justify-between pt-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Policy Enforcement</p>
                  <p className="text-xs text-muted-foreground">
                    High-severity findings require validation before merge
                  </p>
                </div>
                <Switch checked={policyBanner} onCheckedChange={setPolicyBanner} />
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
                      <span className="text-muted-foreground">Environment:</span>
                      <span className="font-medium capitalize">{environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PII Redaction:</span>
                      <span className="font-medium">{piiRedaction ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Personas</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Jenny / Novice</Badge>
                    <Badge variant="secondary">Jenny / Time-pressed</Badge>
                    <Badge variant="secondary">Jenny / Keyboard-only</Badge>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Prototype</h4>
                  <div className="space-y-1.5 text-sm">
                    {validated && (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">
                            {prototypeType === "figma" ? "Figma prototype" : "Live URL"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">24 interactive elements detected</span>
                        </div>
                      </>
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
                  <h4 className="text-sm font-semibold mb-2">Configuration</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mutation level:</span>
                      <span className="font-medium">{mutation[0]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Policy enforcement:</span>
                      <span className="font-medium">{policyBanner ? "Enabled" : "Disabled"}</span>
                    </div>
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
