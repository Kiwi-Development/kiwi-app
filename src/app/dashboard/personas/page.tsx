"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "../../../components/app-layout";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Plus, Trash2, Users, Sparkles, Loader2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Label } from "../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { useToast } from "../../../hooks/use-toast";
import { personaStore, type Persona } from "@/lib/stores";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
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

  useEffect(() => {
    const loadPersonas = async () => {
      const storedPersonas = await personaStore.getPersonas();
      setPersonas(storedPersonas);
    };
    loadPersonas();
  }, []);

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

  const handleSavePersona = async () => {
    if (!newPersonaName || !newPersonaRole) {
      toast({
        title: "Error",
        description: "Please fill in name and role",
        variant: "destructive",
      });
      return;
    }

    if (editingPersona) {
      const updated = await personaStore.updatePersona(editingPersona.id, {
        name: newPersonaName,
        role: newPersonaRole,
        tags: newPersonaTags,
        goals: newPersonaGoals.split("\n").filter(Boolean),
        behaviors: newPersonaBehaviors.split("\n").filter(Boolean),
        frustrations: newPersonaFrustrations.split("\n").filter(Boolean),
        constraints: newPersonaConstraints.split("\n").filter(Boolean),
        accessibility: newPersonaAccessibility.split("\n").filter(Boolean),
      });
      if (updated) {
        const allPersonas = await personaStore.getPersonas();
        setPersonas(allPersonas);
        toast({
          title: "Persona updated",
          description: `${newPersonaName} has been updated`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update persona",
          variant: "destructive",
        });
      }
    } else {
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
        toast({
          title: "Persona created",
          description: `${newPersonaName} has been added to your personas`,
        });
        // Reset form only on success
        setPersonaDialogOpen(false);
        setNewPersonaName("");
        setNewPersonaRole("");
        setNewPersonaTags([]);
        setNewPersonaGoals("");
        setNewPersonaBehaviors("");
        setNewPersonaFrustrations("");
        setNewPersonaConstraints("");
        setNewPersonaAccessibility("");
        setEditingPersona(null);
      } else {
        toast({
          title: "Error",
          description: "Failed to create persona. Check console for details.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setNewPersonaName(persona.name);
    setNewPersonaRole(persona.role);
    setNewPersonaTags([...persona.tags]);
    setNewPersonaGoals(persona.goals?.join("\n") || "");
    setNewPersonaBehaviors(persona.behaviors?.join("\n") || "");
    setNewPersonaFrustrations(persona.frustrations?.join("\n") || "");
    setNewPersonaConstraints(persona.constraints?.join("\n") || "");
    setNewPersonaAccessibility(persona.accessibility?.join("\n") || "");
    setPersonaDialogOpen(true);
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

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>
        <main className="container mx-auto p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
              <p className="text-muted-foreground mt-2">
                Manage your testing personas and their variants
              </p>
            </div>
            <Dialog
              open={personaDialogOpen}
              onOpenChange={(open) => {
                setPersonaDialogOpen(open);
                if (!open) {
                  setNewPersonaName("");
                  setNewPersonaRole("");
                  setNewPersonaTags([]);
                  setNewPersonaGoals("");
                  setNewPersonaBehaviors("");
                  setNewPersonaFrustrations("");
                  setNewPersonaConstraints("");
                  setNewPersonaAccessibility("");
                  setEditingPersona(null);
                  setAiDescription("");
                  setShowAiInput(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="default">
                  <Plus className="h-4 w-4" />
                  <Sparkles className="h-4 w-4 mr-2 text-primary" />
                  New Persona
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPersona ? "Edit Persona" : "Create New Persona"}
                  </DialogTitle>
                  <DialogDescription>
                    Add a new user persona for testing. Personas help simulate different user
                    behaviors.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* AI Generation Section */}
                  {!editingPersona && (
                    <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium">Generate with AI</Label>
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
                  )}
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
                  <Button variant="outline" onClick={() => setPersonaDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePersona}>
                    {editingPersona ? "Update Persona" : "Create Persona"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {personas.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No personas yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Create your first persona to start testing with different user perspectives
                  </p>
                </div>
                <Button size="lg" className="mt-4" onClick={() => setPersonaDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Persona
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="w-[120px]">Last Used</TableHead>
                      <TableHead className="pl-4.5 text-left">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personas.map((persona, index) => (
                      <TableRow key={index} className="group">
                        <TableCell className="font-medium">{persona.name}</TableCell>
                        <TableCell>{persona.role}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {persona.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{persona.lastUsed}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPersona(persona);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const deleted = await personaStore.deletePersona(persona.id);
                                if (deleted) {
                                  const allPersonas = await personaStore.getPersonas();
                                  setPersonas(allPersonas);
                                  toast({
                                    title: "Persona deleted",
                                    description: `${persona.name} has been deleted`,
                                  });
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to delete persona",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              aria-label="Delete persona"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </main>
      </AppLayout>
    </div>
  );
}
