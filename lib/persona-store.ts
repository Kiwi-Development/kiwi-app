export type Persona = {
  id: string
  name: string
  role: string
  tags: string[]
  lastUsed: string
}

class PersonaStore {
  private storageKey = "kiwi_personas"

  getPersonas(): Persona[] {
    if (typeof window === "undefined") return []
    const stored = localStorage.getItem(this.storageKey)
    if (!stored) return this.getDefaultPersonas()
    return JSON.parse(stored)
  }

  private getDefaultPersonas(): Persona[] {
    return [
      {
        id: "1",
        name: "Alex Chen",
        role: "Marketing Manager",
        tags: ["Non-technical", "Time-pressed"],
        lastUsed: "2 hours ago"
      },
      {
        id: "2",
        name: "Taylor Smith",
        role: "UX Designer",
        tags: ["Expert user", "Mobile-first"],
        lastUsed: "1 day ago"
      }
    ]
  }

  addPersona(persona: Omit<Persona, 'id' | 'lastUsed'>) {
    const personas = this.getPersonas()
    const newPersona = {
      ...persona,
      id: Date.now().toString(),
      lastUsed: "Just now"
    }
    const updated = [...personas, newPersona]
    localStorage.setItem(this.storageKey, JSON.stringify(updated))
    return newPersona
  }

  updatePersona(id: string, updates: Partial<Omit<Persona, 'id'>>) {
    const personas = this.getPersonas()
    const updated = personas.map(p => 
      p.id === id ? { ...p, ...updates, lastUsed: "Just now" } : p
    )
    localStorage.setItem(this.storageKey, JSON.stringify(updated))
    return updated.find(p => p.id === id)
  }

  deletePersona(id: string) {
    const updated = this.getPersonas().filter(p => p.id !== id)
    localStorage.setItem(this.storageKey, JSON.stringify(updated))
  }
}

export const personaStore = new PersonaStore()