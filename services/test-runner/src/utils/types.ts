/**
 * Shared TypeScript types
 */

export interface Persona {
  id: string;
  name: string;
  role: string;
  tags?: string[];
  goals: string[];
  behaviors: string[];
  frustrations: string[];
  constraints: string[];
  accessibility: string[];
}

export interface TestData {
  id: string;
  title: string;
  goal: string;
  tasks: string[];
  url: string; // figmaUrl or liveUrl
  personaId: string;
}

export interface SessionInfo {
  sessionId: string;
  stagehand: any; // Stagehand instance
  browserbaseSessionId: string;
  page: any; // Page instance
}

export interface TaskResult {
  success: boolean;
  method: "observe-act" | "act" | "agent";
  duration: number;
  error?: string;
  personaExplanation?: string; // First-person explanation when agent gets stuck
}

export interface TestRunMetrics {
  completedTasks: number;
  totalTasks: number;
  taskCompletionPercentage: number;
  duration: number; // milliseconds
  actionCount: number;
}

export interface TestRunResult {
  success: boolean;
  results: TaskResult[];
  report?: any; // DetailedReport (only if success === true)
  findings?: any[]; // Finding[] (only if success === true)
  error?: string;
  personaExplanation?: string; // Persona explanation when agent gets stuck
  browserbaseSessionId?: string; // Browserbase session ID for live view
  reportGenerated?: boolean; // Whether report was successfully generated
  metrics?: TestRunMetrics; // Task completion metrics
}

