"use client"

import { useState } from "react"
import { AppHeader } from "../../../components/app-header"
import { Button } from "../../../components/ui/button"
import { Card, CardContent } from "../../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Badge } from "../../../components/ui/badge"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useToast } from "../../../hooks/use-toast"

const personas = [
  {
    name: "Jenny Park",
    role: "Product Manager",
    tags: ["Non-technical", "Time-pressed", "Keyboard-friendly"],
    lastUsed: "2 hours ago",
  },
]

export default function PersonasPage() {
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState("")
  const [newPersonaRole, setNewPersonaRole] = useState("")
  const [newPersonaTags, setNewPersonaTags] = useState<string[]>([])
  const { toast } = useToast()

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

  const toggleTag = (tag: string) => {
    setNewPersonaTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
            <p className="text-muted-foreground mt-2">Manage your testing personas and their variants</p>
          </div>
          <Dialog open={personaDialogOpen} onOpenChange={setPersonaDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                New Persona
              </Button>
            </DialogTrigger>
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
                <Button variant="outline" onClick={() => setPersonaDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePersona}>Create Persona</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personas.map((persona, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{persona.name}</TableCell>
                    <TableCell>{persona.role}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {persona.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{persona.lastUsed}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
