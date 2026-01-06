import { supabase } from "../supabase";

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

// Database persona type (matches Supabase schema)
type DatabasePersona = {
  id: string;
  name: string;
  role: string | null;
  variant: string | null;
  user_id: string | null;
  organization_id: string | null;
  attributes: {
    tags?: string[];
    goals?: string[];
    behaviors?: string[];
    frustrations?: string[];
    constraints?: string[];
    accessibility?: string[];
  };
  last_used_at: string | null;
  created_at: string;
};

class PersonaStore {
  // Convert database persona to app persona
  private dbToAppPersona(db: DatabasePersona): Persona {
    const attrs = db.attributes || {};
    const lastUsed = db.last_used_at ? this.formatLastUsed(new Date(db.last_used_at)) : "Never";

    return {
      id: db.id,
      name: db.name,
      role: db.role || db.variant || "",
      tags: attrs.tags || [],
      goals: attrs.goals || [],
      behaviors: attrs.behaviors || [],
      frustrations: attrs.frustrations || [],
      constraints: attrs.constraints || [],
      accessibility: attrs.accessibility || [],
      lastUsed,
    };
  }

  // Convert app persona to database format
  private appToDbPersona(persona: Omit<Persona, "id" | "lastUsed">, userId: string) {
    return {
      name: persona.name,
      role: persona.role,
      variant: persona.role, // Using role as variant for now
      user_id: userId,
      attributes: {
        tags: persona.tags,
        goals: persona.goals,
        behaviors: persona.behaviors,
        frustrations: persona.frustrations,
        constraints: persona.constraints,
        accessibility: persona.accessibility,
      },
    };
  }

  private formatLastUsed(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  }

  async getPersonas(): Promise<Persona[]> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return [];

      // Get personas owned by user or in their organizations
      // RLS will handle the filtering automatically
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .is("deleted_at", null)
        .order("last_used_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error fetching personas:", error);
        return [];
      }

      return (data || []).map((p: DatabasePersona) => this.dbToAppPersona(p));
    } catch (error) {
      console.error("Error in getPersonas:", error);
      return [];
    }
  }

  async getPersonaById(id: string): Promise<Persona | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        console.error("Error fetching persona:", error);
        return null;
      }

      return this.dbToAppPersona(data as DatabasePersona);
    } catch (error) {
      console.error("Error in getPersonaById:", error);
      return null;
    }
  }

  async addPersona(persona: Omit<Persona, "id" | "lastUsed">): Promise<Persona | null> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      const dbPersona = this.appToDbPersona(persona, session.user.id);

      const { data, error } = await supabase.from("personas").insert(dbPersona).select().single();

      if (error) {
        console.error("Error creating persona:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return null;
      }

      if (!data) {
        console.error("No data returned from persona insert");
        return null;
      }

      // Wait a moment for the trigger to create the initial version
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch the persona again to get the current_version_id set by the trigger
      const { data: updatedData, error: fetchError } = await supabase
        .from("personas")
        .select("*")
        .eq("id", data.id)
        .single();

      if (fetchError) {
        console.error("Error fetching persona after creation:", fetchError);
        // Still return the original data even if fetch fails
        return this.dbToAppPersona(data as DatabasePersona);
      }

      return this.dbToAppPersona((updatedData || data) as DatabasePersona);
    } catch (error) {
      console.error("Error in addPersona:", error);
      return null;
    }
  }

  async updatePersona(id: string, updates: Partial<Omit<Persona, "id">>): Promise<Persona | null> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      // Get current persona
      const { data: current, error: fetchError } = await supabase
        .from("personas")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !current) {
        console.error("Error fetching persona:", fetchError);
        return null;
      }

      // Build update object
      const currentPersona = this.dbToAppPersona(current as DatabasePersona);
      const updatedPersona = { ...currentPersona, ...updates };

      const dbUpdate: Partial<DatabasePersona> = {
        name: updatedPersona.name,
        role: updatedPersona.role,
        variant: updatedPersona.role,
        attributes: {
          tags: updatedPersona.tags,
          goals: updatedPersona.goals,
          behaviors: updatedPersona.behaviors,
          frustrations: updatedPersona.frustrations,
          constraints: updatedPersona.constraints,
          accessibility: updatedPersona.accessibility,
        },
      };

      const { data, error } = await supabase
        .from("personas")
        .update(dbUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating persona:", error);
        return null;
      }

      return this.dbToAppPersona(data as DatabasePersona);
    } catch (error) {
      console.error("Error in updatePersona:", error);
      return null;
    }
  }

  async deletePersona(id: string): Promise<boolean> {
    try {
      // First, check if there are any test_runs referencing this persona's versions
      const { data: personaVersions, error: versionsError } = await supabase
        .from("persona_versions")
        .select("id")
        .eq("persona_id", id);

      if (versionsError) {
        console.error("Error checking persona versions:", versionsError);
        // Fall back to soft delete
        return await this.softDeletePersona(id);
      }

      if (personaVersions && personaVersions.length > 0) {
        const versionIds = personaVersions.map((v) => v.id);

        // Check if any test_runs reference these versions
        const { data: testRuns, error: testRunsError } = await supabase
          .from("test_runs")
          .select("id")
          .in("persona_version_id", versionIds)
          .limit(1);

        if (testRunsError) {
          console.error("Error checking test runs:", testRunsError);
          // Fall back to soft delete
          return await this.softDeletePersona(id);
        }

        // If there are test_runs referencing this persona, we can't hard delete
        // due to ON DELETE RESTRICT, so use soft delete instead
        if (testRuns && testRuns.length > 0) {
          console.log("Persona has test runs, using soft delete");
          return await this.softDeletePersona(id);
        }
      }

      // No test_runs reference this persona, safe to hard delete
      // This will cascade delete persona_versions due to ON DELETE CASCADE
      const { error } = await supabase.from("personas").delete().eq("id", id);

      if (error) {
        console.error("Error hard deleting persona:", error);
        // If hard delete fails, fall back to soft delete
        return await this.softDeletePersona(id);
      }

      return true;
    } catch (error) {
      console.error("Error in deletePersona:", error);
      // Fall back to soft delete on any error
      return await this.softDeletePersona(id);
    }
  }

  private async softDeletePersona(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("personas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Error soft deleting persona:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in softDeletePersona:", error);
      return false;
    }
  }
}

export const personaStore = new PersonaStore();
