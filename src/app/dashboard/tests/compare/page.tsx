"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "../../../../components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { testStore } from "../../../../lib/test-store";
import { supabase } from "../../../../lib/supabase";
import { compareRuns } from "../../../../lib/comparison-engine";

export default function ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get("testId"); // Single test - compare all runs
  const testAId = searchParams.get("testA"); // Legacy: two different tests
  const testBId = searchParams.get("testB"); // Legacy: two different tests
  const runAId = searchParams.get("runA"); // Optional: specific run for test A
  const runBId = searchParams.get("runB"); // Optional: specific run for test B
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<any>(null);
  const [allRuns, setAllRuns] = useState<any[]>([]);
  const [test, setTest] = useState<any>(null);

  useEffect(() => {
    const loadComparison = async () => {
      // New: Compare all runs within a single test
      if (testId) {
        try {
          const testData = await testStore.getTestById(testId);
          setTest(testData);

          // Get all runs for this test
          const { data: runs } = await supabase
            .from("test_runs")
            .select("id, created_at, status, task_completion_percentage, duration_seconds, action_count")
            .eq("test_id", testId)
            .order("created_at", { ascending: false });

          if (runs && runs.length >= 2) {
            setAllRuns(runs);
            
            // Compare all runs pairwise and aggregate results
            const comparisons: any[] = [];
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
            const aggregated = await aggregateMultiRunComparison(runs, comparisons);
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

      // Legacy: Compare two different tests
      if (!testAId || !testBId) {
        router.push("/dashboard/tests");
        return;
      }

      try {
        let runA, runB;

        // If specific run IDs are provided, use those; otherwise get latest runs
        if (runAId) {
          const { data } = await supabase
            .from("test_runs")
            .select("id")
            .eq("id", runAId)
            .maybeSingle();
          runA = data;
        } else {
          const { data } = await supabase
            .from("test_runs")
            .select("id")
            .eq("test_id", testAId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          runA = data;
        }

        if (runBId) {
          const { data } = await supabase
            .from("test_runs")
            .select("id")
            .eq("id", runBId)
            .maybeSingle();
          runB = data;
        } else {
          const { data } = await supabase
            .from("test_runs")
            .select("id")
            .eq("test_id", testBId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          runB = data;
        }

        if (runA?.id && runB?.id) {
          const result = await compareRuns(runA.id, runB.id);
          setComparison(result);
        }
      } catch (error) {
        console.error("Error loading comparison:", error);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [testId, testAId, testBId, runAId, runBId, router]);

  // Aggregate findings from multiple pairwise comparisons
  async function aggregateMultiRunComparison(runs: any[], comparisons: any[]) {
    const allFindings = new Map<string, any>();
    const findingCounts: Record<string, { blocker: number; high: number; med: number; low: number }> = {};
    const confusionHotspots = new Map<string, { frequency: number; elements: Set<string> }>();

    // Initialize counts for each run
    runs.forEach((run, idx) => {
      findingCounts[`run${idx + 1}`] = { blocker: 0, high: 0, med: 0, low: 0 };
    });

    // Fetch all findings directly from each run (more efficient than parsing comparisons)
    const allRunFindings: Record<string, any[]> = {};
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
      
      findings.forEach((entry: any) => {
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
            category: entry.category,
            evidence_snippets: entry.evidence_snippets || [],
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
          entry.evidence_snippets.forEach((evidence: any) => {
            if (evidence.ui_anchor) {
              const area = evidence.ui_anchor.frame_name || evidence.ui_anchor.element_label || "Unknown";
              const element = evidence.ui_anchor.element_selector || evidence.ui_anchor.element_label || "";
              
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
      test,
      runs,
      allFindings: Array.from(allFindings.values()),
      findingCounts,
      confusionHotspots: Array.from(confusionHotspots.entries())
        .map(([area, data]) => ({
          area,
          frequency: data.frequency,
          elements: Array.from(data.elements),
        }))
        .sort((a, b) => b.frequency - a.frequency)
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

  // Check if this is a multi-run comparison (new format) or legacy 2-test comparison
  const isMultiRunComparison = comparison.runs && comparison.runs.length > 0;

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
                ? `Comparing ${comparison.runs.length} runs for "${comparison.test?.title || "Test"}"`
                : "Before and after analysis"}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {isMultiRunComparison ? (
          <>
            {/* Multi-Run Comparison View */}
            <div className="grid gap-4">
              {/* Run Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {comparison.runs.map((run: any, idx: number) => {
                  const runNum = idx + 1;
                  const counts = comparison.findingCounts[`run${runNum}`] || {
                    blocker: 0,
                    high: 0,
                    med: 0,
                    low: 0,
                  };
                  const totalFindings = counts.blocker + counts.high + counts.med + counts.low;
                  const date = new Date(run.created_at);
                  const dateStr = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <Card key={run.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Run {runNum}</CardTitle>
                        <CardDescription>{dateStr}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-2xl font-bold">{totalFindings}</div>
                        <div className="text-xs text-muted-foreground">Total Findings</div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div>
                            <Badge variant="destructive" className="text-xs">
                              {counts.blocker + counts.high}
                            </Badge>
                            <span className="ml-1 text-muted-foreground">High/Blocker</span>
                          </div>
                          <div>
                            <Badge variant="default" className="text-xs">
                              {counts.med}
                            </Badge>
                            <span className="ml-1 text-muted-foreground">Med</span>
                          </div>
                          <div>
                            <Badge variant="secondary" className="text-xs">
                              {counts.low}
                            </Badge>
                            <span className="ml-1 text-muted-foreground">Low</span>
                          </div>
                          <div className="text-muted-foreground">
                            {run.task_completion_percentage
                              ? `${Math.round(run.task_completion_percentage)}%`
                              : "—"}
                            <span className="ml-1">Complete</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

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
                    {comparison.allFindings && comparison.allFindings.length > 0 ? (
                      comparison.allFindings.map((finding: any, idx: number) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{finding.title}</h4>
                                <Badge
                                  variant={
                                    finding.severity === "Blocker" || finding.severity === "High"
                                      ? "destructive"
                                      : finding.severity === "Med"
                                        ? "default"
                                        : "secondary"
                                  }
                                >
                                  {finding.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {finding.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Appears in:</span>
                                {comparison.runs.map((run: any, runIdx: number) => {
                                  const runNum = runIdx + 1;
                                  const appears = finding.appearsInRuns?.has(`run${runNum}`);
                                  return (
                                    <Badge
                                      key={runNum}
                                      variant={appears ? "default" : "outline"}
                                      className="text-xs"
                                    >
                                      Run {runNum}
                                    </Badge>
                                  );
                                })}
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

              {/* Confusion Hotspots */}
              {comparison.confusionHotspots && comparison.confusionHotspots.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Confusion Hotspots</CardTitle>
                    <CardDescription>
                      UI areas that triggered issues across multiple runs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {comparison.confusionHotspots
                        .sort((a: any, b: any) => b.frequency - a.frequency)
                        .map((hotspot: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 border rounded">
                            <span className="font-medium">{hotspot.area}</span>
                            <Badge>{hotspot.frequency} occurrences</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Legacy 2-Test Comparison View */}
            <div className="grid gap-4 md:grid-cols-4">
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
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Hotspots</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {comparison.confusionHotspots?.length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Findings Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Run A Findings</CardTitle>
                  <CardDescription>
                    {comparison.findingCounts?.a
                      ? comparison.findingCounts.a.blocker +
                        comparison.findingCounts.a.high +
                        comparison.findingCounts.a.med +
                        comparison.findingCounts.a.low
                      : 0}{" "}
                    total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Blocker:</span>
                      <Badge variant="destructive">
                        {comparison.findingCounts?.a?.blocker || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>High:</span>
                      <Badge variant="destructive">
                        {comparison.findingCounts?.a?.high || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Med:</span>
                      <Badge>{comparison.findingCounts?.a?.med || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Low:</span>
                      <Badge variant="secondary">
                        {comparison.findingCounts?.a?.low || 0}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Run B Findings</CardTitle>
                  <CardDescription>
                    {comparison.findingCounts?.b
                      ? comparison.findingCounts.b.blocker +
                        comparison.findingCounts.b.high +
                        comparison.findingCounts.b.med +
                        comparison.findingCounts.b.low
                      : 0}{" "}
                    total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Blocker:</span>
                      <Badge variant="destructive">
                        {comparison.findingCounts?.b?.blocker || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>High:</span>
                      <Badge variant="destructive">
                        {comparison.findingCounts?.b?.high || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Med:</span>
                      <Badge>{comparison.findingCounts?.b?.med || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Low:</span>
                      <Badge variant="secondary">
                        {comparison.findingCounts?.b?.low || 0}
                      </Badge>
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
              <CardDescription>Issues that were in Run A but not in Run B</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison.resolved.map((finding: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="font-semibold">{finding.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{finding.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* New Findings */}
        {comparison.newFindings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                New Findings ({comparison.newFindings.length})
              </CardTitle>
              <CardDescription>Issues that appeared in Run B but not in Run A</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison.newFindings.map((finding: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{finding.title}</div>
                    <Badge variant={finding.severity === "High" || finding.severity === "Blocker" ? "destructive" : "secondary"}>
                      {finding.severity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{finding.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Regressions */}
        {comparison.regressions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
                Regressions ({comparison.regressions.length})
              </CardTitle>
              <CardDescription>Issues that got worse in Run B</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison.regressions.map((regression: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg border-orange-200">
                  <div className="font-semibold">{regression.finding.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{regression.finding.description}</div>
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

        {/* Confusion Hotspots */}
        {comparison.confusionHotspots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Confusion Hotspots</CardTitle>
              <CardDescription>UI areas with the most issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparison.confusionHotspots.map((hotspot: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="font-semibold">{hotspot.area}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {hotspot.issueCount} issue{hotspot.issueCount !== 1 ? "s" : ""}
                  </div>
                  {hotspot.elements && hotspot.elements.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {hotspot.elements.map((elem: string, eIdx: number) => (
                        <Badge key={eIdx} variant="outline" className="text-xs">
                          {elem}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

