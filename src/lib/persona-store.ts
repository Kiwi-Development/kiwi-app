export type Persona = {
  id: string;
  name: string;
  role: string;
  tags: string[];
  goals: string[];
  behaviors: string[];
  frustrations: string[];
  constraints: string[];
  accessibility: string[];
  lastUsed: string;
};

class PersonaStore {
  private storageKey = "kiwi_personas";

  getPersonas(): Persona[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return this.getDefaultPersonas();
    return JSON.parse(stored);
  }

  private getDefaultPersonas(): Persona[] {
    return [
      {
        id: "1",
        name: "Alex Chen",
        role: "Marketing Manager",
        tags: ["Non-technical", "Time-pressed"],
        goals: ["Create campaigns quickly", "Analyze performance metrics"],
        behaviors: ["Skims content", "Uses keyboard shortcuts"],
        frustrations: ["Slow loading times", "Complex navigation"],
        constraints: ["Limited technical knowledge", "Tight deadlines"],
        accessibility: ["Prefers high contrast"],
        lastUsed: "2 hours ago",
      },
      {
        id: "2",
        name: "Taylor Smith",
        role: "UX Designer",
        tags: ["Expert user", "Mobile-first"],
        goals: ["Validate design patterns", "Check responsiveness"],
        behaviors: ["Detailed inspection", "Uses developer tools"],
        frustrations: ["Inconsistent UI", "Lack of customization"],
        constraints: ["Mobile-only access sometimes"],
        accessibility: [],
        lastUsed: "1 day ago",
      },
    ];
  }

  addPersona(persona: Omit<Persona, "id" | "lastUsed">) {
    const personas = this.getPersonas();
    const newPersona = {
      ...persona,
      id: Date.now().toString(),
      lastUsed: "Just now",
    };
    const updated = [...personas, newPersona];
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    return newPersona;
  }

  updatePersona(id: string, updates: Partial<Omit<Persona, "id">>) {
    const personas = this.getPersonas();
    const updated = personas.map((p) =>
      p.id === id ? { ...p, ...updates, lastUsed: "Just now" } : p
    );
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    return updated.find((p) => p.id === id);
  }

  deletePersona(id: string) {
    const updated = this.getPersonas().filter((p) => p.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
  }
}

export const personaStore = new PersonaStore();
