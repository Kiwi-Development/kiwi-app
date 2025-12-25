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
import { Plus, Trash2 } from "lucide-react";
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
import { useToast } from "../../../../hooks/use-toast";
import { personaStore, type Persona } from "../../../lib/persona-store";

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
  const { toast } = useToast();

  useEffect(() => {
    const storedPersonas = personaStore.getPersonas();
    // Initialize state from store - this is acceptable for one-time initialization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonas(storedPersonas);
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

  const handleSavePersona = () => {
    if (!newPersonaName || !newPersonaRole) {
      toast({
        title: "Error",
        description: "Please fill in name and role",
        variant: "destructive",
      });
      return;
    }

    if (editingPersona) {
      const updated = personaStore.updatePersona(editingPersona.id, {
        name: newPersonaName,
        role: newPersonaRole,
        tags: newPersonaTags,
        goals: newPersonaGoals.split("\n").filter(Boolean),
        behaviors: newPersonaBehaviors.split("\n").filter(Boolean),
        frustrations: newPersonaFrustrations.split("\n").filter(Boolean),
        constraints: newPersonaConstraints.split("\n").filter(Boolean),
        accessibility: newPersonaAccessibility.split("\n").filter(Boolean),
      });
      setPersonas(personaStore.getPersonas());
      toast({
        title: "Persona updated",
        description: `${newPersonaName} has been updated`,
      });
    } else {
      const newPersona = personaStore.addPersona({
        name: newPersonaName,
        role: newPersonaRole,
        tags: newPersonaTags,
        goals: newPersonaGoals.split("\n").filter(Boolean),
        behaviors: newPersonaBehaviors.split("\n").filter(Boolean),
        frustrations: newPersonaFrustrations.split("\n").filter(Boolean),
        constraints: newPersonaConstraints.split("\n").filter(Boolean),
        accessibility: newPersonaAccessibility.split("\n").filter(Boolean),
      });
      setPersonas([...personas, newPersona]);
      toast({
        title: "Persona created",
        description: `${newPersonaName} has been added to your personas`,
      });
    }

    // Reset form
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

    setPersonas(personaStore.getPersonas());
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
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="h-4 w-4 mr-2" />
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
                            onClick={(e) => {
                              e.stopPropagation();
                              personaStore.deletePersona(persona.id);
                              setPersonas(personaStore.getPersonas());
                              toast({
                                title: "Persona deleted",
                                description: `${persona.name} has been removed`,
                              });
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
        </main>
      </AppLayout>
    </div>
  );
}
