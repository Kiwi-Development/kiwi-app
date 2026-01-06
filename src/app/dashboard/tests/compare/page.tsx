"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "../../../../components/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { testStore, type Test } from "@/lib/stores";
import { supabase } from "../../../../lib/supabase";
import { compareRuns } from "@/lib/utils";
import type {
  ComparisonResult,
  Finding,
  TestRunRow,
  FeedbackEntryRow,
  FindingCounts,
  FindingCategory,
  EvidenceSnippet,
  Regression,
} from "@/types";
import type { MultiRunComparison, MultiTestComparison } from "@/types/comparison";

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get("testId"); // Single test - compare all runs

  // Get all test IDs from URL (test1, test2, test3, etc. or legacy testA, testB)
  const testIds: string[] = [];
  let idx = 1;
  while (searchParams.get(`test${idx}`)) {
    testIds.push(searchParams.get(`test${idx}`)!);
    idx++;
  }
  // Support legacy testA and testB for backwards compatibility
  const testAId = searchParams.get("testA");
  const testBId = searchParams.get("testB");
  const runAId = searchParams.get("runA"); // Optional: specific run for test A
  const runBId = searchParams.get("runB"); // Optional: specific run for test B
  if (testAId && !testIds.includes(testAId)) testIds.push(testAId);
  if (testBId && !testIds.includes(testBId)) testIds.push(testBId);

  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<
    ComparisonResult | MultiRunComparison | MultiTestComparison | null
  >(null);
  const [allRuns, setAllRuns] = useState<TestRunRow[]>([]);
  const [test, setTest] = useState<Test | null>(null);
  const [tests, setTests] = useState<Test[]>([]); // Array of all tests being compared
  const [testRuns, setTestRuns] = useState<Record<string, TestRunRow[]>>({}); // Runs for each test
  const [selectedRuns, setSelectedRuns] = useState<Record<string, string>>({}); // Selected run ID for each test
  // Legacy state for 2-test comparison (backwards compatibility)
  const [runA, setRunA] = useState<TestRunRow | null>(null);
  const [runB, setRunB] = useState<TestRunRow | null>(null);
  const [testARuns, setTestARuns] = useState<TestRunRow[]>([]);
  const [testBRuns, setTestBRuns] = useState<TestRunRow[]>([]);
  const [selectedRunAId, setSelectedRunAId] = useState<string | null>(null);
  const [selectedRunBId, setSelectedRunBId] = useState<string | null>(null);
  const [testA, setTestA] = useState<Test | null>(null);
  const [testB, setTestB] = useState<Test | null>(null);

  useEffect(() => {
    const loadComparison = async () => {
      // New: Compare all runs within a single test
      if (testId) {
        try {
          const testData = await testStore.getTestById(testId);
          setTest(testData || null);

          // Get all runs for this test
          const { data: runs } = await supabase
            .from("test_runs")
            .select(
              "id, test_id, created_at, status, task_completion_percentage, duration_seconds, action_count"
            )
            .eq("test_id", testId)
            .order("created_at", { ascending: false });

          if (runs && runs.length >= 2) {
            setAllRuns(runs as TestRunRow[]);

            // Compare all runs pairwise and aggregate results
            const comparisons: Array<{
              runA: TestRunRow;
              runB: TestRunRow;
              comparison: ComparisonResult;
            }> = [];
            for (let i = 0; i < runs.length - 1; i++) {
              for (let j = i + 1; j < runs.length; j++) {
                const result = await compareRuns(runs[i].id, runs[j].id);
                comparisons.push({
                  runA: runs[i],
                  runB: runs[j],
                  comparison: result,
                });
              }
            }

            // Aggregate findings across all comparisons
            const aggregated = await aggregateMultiRunComparison(runs as TestRunRow[], comparisons);
            setComparison(aggregated);
          } else {
            // Not enough runs to compare
            setComparison(null);
          }
        } catch (error) {
          console.error("Error loading multi-run comparison:", error);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Compare multiple tests (2 or more)
      if (testIds.length < 2) {
        router.push("/dashboard/tests");
        return;
      }

      try {
        // Load all test data
        const loadedTests = await Promise.all(testIds.map((id) => testStore.getTestById(id)));
        const validTests = loadedTests.filter((t): t is Test => t !== undefined);
        setTests(validTests);

        // For backwards compatibility, set testA and testB if we have exactly 2 tests
        if (validTests.length === 2) {
          setTestA(validTests[0]);
          setTestB(validTests[1]);
        }

        // Load all runs for all tests
        const runsMap: Record<string, TestRunRow[]> = {};
        const selectedRunsMap: Record<string, string> = {};

        for (const test of validTests) {
          const { data: runs } = await supabase
            .from("test_runs")
            .select(
              "id, test_id, created_at, status, task_completion_percentage, duration_seconds, action_count"
            )
            .eq("test_id", test.id)
            .order("created_at", { ascending: false });

          runsMap[test.id] = (runs || []) as TestRunRow[];
          // Select latest run by default
          if (runs && runs.length > 0) {
            selectedRunsMap[test.id] = runs[0].id;
          }
        }

        setTestRuns(runsMap);
        setSelectedRuns(selectedRunsMap);

        // For 2 tests, use the legacy comparison format
        if (validTests.length === 2) {
          const testA = validTests[0];
          const testB = validTests[1];
          const runsA = runsMap[testA.id] || [];
          const runsB = runsMap[testB.id] || [];

          setTestARuns(runsA);
          setTestBRuns(runsB);

          // Get selected runs (or latest)
          const runAData = runAId ? runsA.find((r) => r.id === runAId) : runsA[0];
          const runBData = runBId ? runsB.find((r) => r.id === runBId) : runsB[0];

          if (runAData?.id && runBData?.id) {
            setRunA(runAData);
            setRunB(runBData);
            setSelectedRunAId(runAData.id);
            setSelectedRunBId(runBData.id);
            const result = await compareRuns(runAData.id, runBData.id);
            setComparison(result);
          }
        } else {
          // For 3+ tests, aggregate findings from all tests
          // Compare all pairs and aggregate results
          const allFindings: Finding[] = [];
          const findingCounts: Record<string, FindingCounts> = {};

          for (let i = 0; i < validTests.length; i++) {
            const test = validTests[i];
            const runs = runsMap[test.id] || [];
            const selectedRunId = selectedRunsMap[test.id];
            const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0];

            if (selectedRun?.id) {
              // Get findings for this test's selected run
              const { data: entries } = await supabase
                .from("feedback_entries")
                .select("*")
                .eq("test_run_id", selectedRun.id)
                .order("created_at", { ascending: false });

              const testFindings = (entries || []).map(
                (e: FeedbackEntryRow): Finding & { testId: string; testTitle: string } => ({
                  id: e.id,
                  title: e.title,
                  severity: e.severity,
                  confidence: e.confidence,
                  description: e.description,
                  suggestedFix: e.suggested_fix || "",
                  affectingTasks: (e.affecting_tasks || []) as string[],
                  frequency: e.frequency || 1,
                  category: e.category as FindingCategory | undefined,
                  evidence_snippets: (e.evidence_snippets || []) as EvidenceSnippet[],
                  testId: test.id,
                  testTitle: test.title,
                })
              );

              allFindings.push(...testFindings);

              // Count findings by severity for this test
              const counts = { blocker: 0, high: 0, med: 0, low: 0 };
              testFindings.forEach((f) => {
                if (f.severity === "Blocker") counts.blocker++;
                else if (f.severity === "High") counts.high++;
                else if (f.severity === "Med") counts.med++;
                else counts.low++;
              });
              findingCounts[test.id] = counts;
            }
          }

          setComparison({
            tests: validTests,
            allFindings,
            findingCounts,
            isMultiTest: true,
          } as MultiTestComparison);
        }
      } catch (error) {
        console.error("Error loading comparison:", error);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [testId, testIds.join(","), router]);

  // Aggregate findings from multiple pairwise comparisons
  async function aggregateMultiRunComparison(
    runs: TestRunRow[],
    comparisons: Array<{ runA: TestRunRow; runB: TestRunRow; comparison: ComparisonResult }>
  ): Promise<MultiRunComparison> {
    const allFindings = new Map<
      string,
      Finding & {
        appearsInRuns: Set<string>;
        severityByRun: Record<string, string>;
        frequencyByRun: Record<string, number>;
      }
    >();
    const findingCounts: Record<
      string,
      { blocker: number; high: number; med: number; low: number }
    > = {};
    const confusionHotspots = new Map<string, { frequency: number; elements: Set<string> }>();

    // Initialize counts for each run
    runs.forEach((run, idx) => {
      findingCounts[`run${idx + 1}`] = { blocker: 0, high: 0, med: 0, low: 0 };
    });

    // Fetch all findings directly from each run (more efficient than parsing comparisons)
    const allRunFindings: Record<string, FeedbackEntryRow[]> = {};
    for (const run of runs) {
      const { data: entries } = await supabase
        .from("feedback_entries")
        .select("*")
        .eq("test_run_id", run.id)
        .order("created_at", { ascending: false });

      allRunFindings[run.id] = entries || [];
    }

    // Collect all unique findings across all runs
    runs.forEach((run, runIdx) => {
      const runNum = runIdx + 1;
      const findings = allRunFindings[run.id] || [];

      findings.forEach((entry: FeedbackEntryRow) => {
        const key = entry.title.toLowerCase();
        if (!allFindings.has(key)) {
          allFindings.set(key, {
            id: entry.id,
            title: entry.title,
            severity: entry.severity,
            confidence: entry.confidence,
            description: entry.description,
            suggestedFix: entry.suggested_fix || "",
            affectingTasks: (entry.affecting_tasks as string[]) || [],
            frequency: entry.frequency || 1,
            category: (entry.category as FindingCategory | undefined) || undefined,
            evidence_snippets: (entry.evidence_snippets || []) as EvidenceSnippet[],
            appearsInRuns: new Set(),
            severityByRun: {},
            frequencyByRun: {},
          });
        }
        const f = allFindings.get(key)!;
        f.appearsInRuns.add(`run${runNum}`);
        f.severityByRun[`run${runNum}`] = entry.severity;
        f.frequencyByRun[`run${runNum}`] = entry.frequency || 1;

        // Count by severity for this run
        const counts = findingCounts[`run${runNum}`];
        if (entry.severity === "Blocker") counts.blocker++;
        else if (entry.severity === "High") counts.high++;
        else if (entry.severity === "Med") counts.med++;
        else counts.low++;

        // Aggregate confusion hotspots from evidence snippets
        if (entry.evidence_snippets && Array.isArray(entry.evidence_snippets)) {
          (entry.evidence_snippets as EvidenceSnippet[]).forEach((evidence: EvidenceSnippet) => {
            if (evidence.ui_anchor) {
              const area =
                evidence.ui_anchor.frame_name || evidence.ui_anchor.element_label || "Unknown";
              const element =
                evidence.ui_anchor.element_selector || evidence.ui_anchor.element_label || "";

              if (!confusionHotspots.has(area)) {
                confusionHotspots.set(area, { frequency: 0, elements: new Set() });
              }
              const h = confusionHotspots.get(area)!;
              h.frequency += 1;
              if (element) h.elements.add(element);
            }
          });
        }
      });
    });

    return {
      runs,
      allFindings: Array.from(allFindings.values()),
      findingCounts,
      confusionHotspots: Array.from(confusionHotspots.entries())
        .map(([area, data]) => ({
          area,
          issueCount: data.frequency,
          elements: Array.from(data.elements),
        }))
        .sort((a, b) => b.issueCount - a.issueCount)
        .slice(0, 10), // Top 10 hotspots
    };
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">Loading comparison...</div>
        </div>
      </AppLayout>
    );
  }

  if (!comparison) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Unable to load comparison data.</p>
            <Button onClick={() => router.push("/dashboard/tests")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tests
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check if this is a multi-run comparison (new format) or multi-test comparison
  const isMultiRunComparison =
    comparison && "runs" in comparison && comparison.runs && comparison.runs.length > 0;
  const isMultiTestComparison =
    comparison && "isMultiTest" in comparison && comparison.isMultiTest === true;

  // Ensure test data is loaded
  if (!isMultiRunComparison && !isMultiTestComparison && (!testA || !testB) && tests.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">Loading test data...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isMultiRunComparison ? "Compare All Runs" : "Compare Tests"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isMultiRunComparison
                ? `Comparing ${isMultiRunComparison && "runs" in comparison ? comparison.runs.length : 0} runs`
                : isMultiTestComparison
                  ? `Comparing ${tests.length} tests`
                  : testA && testB
                    ? `Comparing "${testA.title}" vs "${testB.title}"`
                    : "Comparing test runs"}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {isMultiTestComparison ? (
          <>
            {/* Multi-Test Comparison View (3+ tests) */}
            <div className="grid gap-4">
              {/* Summary Cards for Each Test */}
              <div className="grid gap-4 md:grid-cols-3">
                {tests.map((test, idx) => {
                  const counts = (comparison &&
                  "findingCounts" in comparison &&
                  typeof comparison.findingCounts === "object" &&
                  !("a" in comparison.findingCounts) &&
                  test.id in comparison.findingCounts
                    ? comparison.findingCounts[test.id]
                    : undefined) || {
                    blocker: 0,
                    high: 0,
                    med: 0,
                    low: 0,
                  };
                  return (
                    <Card key={test.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{test.title}</CardTitle>
                        <CardDescription>Test {idx + 1}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">High</span>
                            <span className="font-semibold text-red-600">
                              {counts.high + counts.blocker}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Med</span>
                            <span className="font-semibold text-yellow-600">{counts.med}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Low</span>
                            <span className="font-semibold text-blue-600">{counts.low}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* All Findings from All Tests */}
              <Card>
                <CardHeader>
                  <CardTitle>All Findings Across Tests</CardTitle>
                  <CardDescription>
                    {comparison && "allFindings" in comparison
                      ? comparison.allFindings?.length || 0
                      : 0}{" "}
                    total findings from {tests.length} tests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comparison &&
                    "allFindings" in comparison &&
                    comparison.allFindings &&
                    comparison.allFindings.length > 0 ? (
                      comparison.allFindings.map((finding: Finding, idx: number) => (
                        <div key={idx} className="border-b pb-4 last:border-0">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold">{finding.title}</h4>
                            <Badge
                              variant={
                                finding.severity === "High" || finding.severity === "Blocker"
                                  ? "destructive"
                                  : finding.severity === "Med"
                                    ? "default"
                                    : "secondary"
                              }
                              className={
                                finding.severity === "Med"
                                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                  : ""
                              }
                            >
                              {finding.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {finding.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              From: {(finding as Finding & { testTitle: string }).testTitle}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No findings to display.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : isMultiRunComparison ? (
          <>
            {/* Multi-Run Comparison View */}
            <div className="grid gap-4">
              {/* All Findings Across Runs */}
              <Card>
                <CardHeader>
                  <CardTitle>All Findings Across Runs</CardTitle>
                  <CardDescription>
                    Findings that appeared in one or more runs, showing which runs they appeared in
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comparison &&
                    "allFindings" in comparison &&
                    comparison.allFindings &&
                    comparison.allFindings.length > 0 ? (
                      comparison.allFindings.map((finding: Finding, idx: number) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{finding.title}</h4>
                                <Badge
                                  variant={
                                    finding.severity === "High"
                                      ? "destructive"
                                      : finding.severity === "Med"
                                        ? "secondary"
                                        : "secondary"
                                  }
                                  className={
                                    finding.severity === "Med"
                                      ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                      : ""
                                  }
                                >
                                  {finding.severity === "Blocker" ? "High" : finding.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {finding.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Appears in:</span>
                                {comparison &&
                                  "runs" in comparison &&
                                  (comparison.runs as TestRunRow[]).map(
                                    (run: TestRunRow, runIdx: number) => {
                                      const runNum = runIdx + 1;
                                      const extendedFinding = finding as Finding & {
                                        appearsInRuns?: Set<string>;
                                      };
                                      const appears = extendedFinding.appearsInRuns?.has(
                                        `run${runNum}`
                                      );
                                      if (!appears) return null;
                                      return (
                                        <Badge
                                          key={runNum}
                                          variant="outline"
                                          className="text-xs bg-background border-border"
                                        >
                                          Run {runNum}
                                        </Badge>
                                      );
                                    }
                                  )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No findings to display
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : comparison && "resolved" in comparison ? (
          <>
            {/* Legacy 2-Test Comparison View (ComparisonResult) */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Resolved</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {comparison.resolved?.length || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>New Issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {comparison.newFindings?.length || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Regressions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {comparison.regressions?.length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Run Selectors (if multiple runs available) */}
            {(testARuns.length > 1 || testBRuns.length > 1) && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Runs to Compare</CardTitle>
                  <CardDescription>
                    Choose which runs from each test you want to compare
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {testARuns.length > 1 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Test A Run</label>
                        <Select
                          value={selectedRunAId || runA?.id || ""}
                          onValueChange={async (value) => {
                            const selectedRun = testARuns.find((r) => r.id === value);
                            if (selectedRun && runB) {
                              setSelectedRunAId(value);
                              setRunA(selectedRun);
                              const result = await compareRuns(selectedRun.id, runB.id);
                              setComparison(result);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {testARuns.map((run) => {
                              const date = new Date(run.created_at || "");
                              const dateStr = date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <SelectItem key={run.id} value={run.id}>
                                  {dateStr}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {testBRuns.length > 1 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Test B Run</label>
                        <Select
                          value={selectedRunBId || runB?.id || ""}
                          onValueChange={async (value) => {
                            const selectedRun = testBRuns.find((r) => r.id === value);
                            if (selectedRun && runA) {
                              setSelectedRunBId(value);
                              setRunB(selectedRun);
                              const result = await compareRuns(runA.id, selectedRun.id);
                              setComparison(result);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {testBRuns.map((run) => {
                              const date = new Date(run.created_at || "");
                              const dateStr = date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <SelectItem key={run.id} value={run.id}>
                                  {dateStr}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Findings Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {testA?.title ? `${testA.title} Findings` : "Test A Findings"}
                  </CardTitle>
                  <CardDescription>
                    {comparison.findingCounts?.a
                      ? comparison.findingCounts.a.high +
                        comparison.findingCounts.a.med +
                        comparison.findingCounts.a.low
                      : 0}{" "}
                    total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">High:</span>
                      <Badge variant="destructive">
                        {(comparison.findingCounts?.a?.blocker || 0) +
                          (comparison.findingCounts?.a?.high || 0)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Med:</span>
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        {comparison.findingCounts?.a?.med || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Low:</span>
                      <Badge variant="secondary">{comparison.findingCounts?.a?.low || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {testB?.title ? `${testB.title} Findings` : "Test B Findings"}
                  </CardTitle>
                  <CardDescription>
                    {comparison.findingCounts?.b
                      ? comparison.findingCounts.b.high +
                        comparison.findingCounts.b.med +
                        comparison.findingCounts.b.low
                      : 0}{" "}
                    total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">High:</span>
                      <Badge variant="destructive">
                        {(comparison.findingCounts?.b?.blocker || 0) +
                          (comparison.findingCounts?.b?.high || 0)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Med:</span>
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        {comparison.findingCounts?.b?.med || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Low:</span>
                      <Badge variant="secondary">{comparison.findingCounts?.b?.low || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resolved Findings */}
            {comparison.resolved.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Resolved Findings ({comparison.resolved.length})
                  </CardTitle>
                  <CardDescription>
                    Issues that were in {testA ? `"${testA.title}"` : "Test A"} but not in{" "}
                    {testB ? `"${testB.title}"` : "Test B"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparison.resolved.map((finding: Finding, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="font-semibold">{finding.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {finding.description}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* New Findings */}
            {"newFindings" in comparison && comparison.newFindings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    New Findings ({comparison.newFindings.length})
                  </CardTitle>
                  <CardDescription>
                    Issues that appeared in {testB ? `"${testB.title}"` : "Test B"} but not in{" "}
                    {testA ? `"${testA.title}"` : "Test A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparison.newFindings.map((finding: Finding, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{finding.title}</div>
                        <Badge
                          variant={finding.severity === "High" ? "destructive" : "secondary"}
                          className={
                            finding.severity === "Med"
                              ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                              : finding.severity === "Blocker"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : ""
                          }
                        >
                          {finding.severity === "Blocker" ? "High" : finding.severity}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{finding.description}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Regressions */}
            {"regressions" in comparison && comparison.regressions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                    Regressions ({comparison.regressions.length})
                  </CardTitle>
                  <CardDescription>Issues that got worse in Run B</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparison.regressions.map((regression: Regression, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg border-orange-200">
                      <div className="font-semibold">{regression.finding.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {regression.finding.description}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span>Severity: {regression.severityChange}</span>
                        {regression.frequencyChange && (
                          <span>Frequency: {regression.frequencyChange}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-center h-64">
              <p>Loading comparison...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
