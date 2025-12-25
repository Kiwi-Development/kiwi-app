type Test = {
  id: string;
  title: string;
  status: "draft" | "queued" | "running" | "completed" | "needs-validation" | "error";
  lastRun: string;
  personas: string[];
  artifactType: string;
  successRate?: number;
  avgTime?: string;
  createdAt: number;
  testData?: {
    testName: string;
    goal: string;
    selectedPersona: string;
    useCase: string;
    tasks: string[];
    figmaUrlA?: string;
    figmaUrlB?: string;
    liveUrl?: string;
  };
  progressState?: {
    completedPersonas: number;
    totalPersonas: number;
    startTime: number;
    estimatedDuration: number; // in milliseconds
  };
  feedback?: string;
  findings?: {
    title: string;
    severity: "High" | "Med" | "Low";
    confidence: number;
    description: string;
    suggestedFix: string;
    affectingTasks: string[];
  }[];
  nextSteps?: {
    userExperience: string[];
    informationArchitecture: string[];
    accessibility: string[];
  };
  duration?: number; // in milliseconds
  actionCount?: number;
  completedAt?: number;
};

class TestStore {
  private storageKey = "kiwi_tests";

  getTests(): Test[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return this.getDefaultTests();
    return JSON.parse(stored);
  }

  private getDefaultTests(): Test[] {
    return [];
  }

  saveTest(test: Test) {
    const tests = this.getTests();
    const existingIndex = tests.findIndex((t) => t.id === test.id);

    if (existingIndex >= 0) {
      tests[existingIndex] = test;
    } else {
      tests.push(test);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(this.storageKey, JSON.stringify(tests));
    }
  }

  updateTestProgress(id: string, completedPersonas: number, totalPersonas: number) {
    const test = this.getTestById(id);
    if (!test) return;

    const successRate =
      totalPersonas > 0 ? Math.round((completedPersonas / totalPersonas) * 100) : 0;

    test.progressState = {
      completedPersonas,
      totalPersonas,
      startTime: test.progressState?.startTime || Date.now(),
      estimatedDuration: test.progressState?.estimatedDuration || 480000, // 8 minutes default
    };
    test.successRate = successRate;

    if (completedPersonas >= totalPersonas) {
      test.status = "completed";
    } else if (test.status !== "running") {
      test.status = "running";
    }

    console.log("[v0] Updated test progress:", {
      id,
      completedPersonas,
      totalPersonas,
      successRate,
      status: test.status,
    });

    this.saveTest(test);
  }

  deleteTest(id: string) {
    const tests = this.getTests().filter((t) => t.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem(this.storageKey, JSON.stringify(tests));
    }
  }

  getTestById(id: string): Test | undefined {
    return this.getTests().find((t) => t.id === id);
  }
}

export const testStore = new TestStore();
export type { Test };
