"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { AppLayout } from "../../../components/app-layout";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import { Clock, Users, Target, Trash2 } from "lucide-react";
import { testStore, type Test } from "../../../lib/test-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Initialize state from store - this is acceptable for one-time initialization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTests(testStore.getTests());

    const interval = setInterval(() => {
      const currentTests = testStore.getTests();
      setTests([...currentTests]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, testId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTestToDelete(testId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (testToDelete) {
      testStore.deleteTest(testToDelete);
      setTests(testStore.getTests());
      setTestToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const calculateSuccessRate = (test: Test): number => {
    if (test.status === "running" && test.progressState) {
      return Math.round(
        (test.progressState.completedPersonas / test.progressState.totalPersonas) * 100
      );
    }
    return test.successRate || 0;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getTestLink = (test: Test): string => {
    if (test.status === "completed") {
      return `/dashboard/reports/${test.id}`;
    }
    return `/dashboard/runs/${test.id}`;
  };

  const TestCard = ({ test }: { test: Test }) => (
    <div className="relative group">
      <Link href={getTestLink(test)}>
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{test.title}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {test.completedAt ? formatTimeAgo(test.completedAt) : test.lastRun}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {test.personas.length} variants
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    {test.artifactType}
                  </span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={test.status === "completed" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {test.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteClick(e, test.id)}
                  aria-label="Delete test"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {calculateSuccessRate(test)}%
                </div>
                <div className="text-xs text-muted-foreground">Task success</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {test.duration ? formatDuration(test.duration) : test.avgTime || "—"}
                </div>
                <div className="text-xs text-muted-foreground">Avg time</div>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {test.personas.map((persona) => (
                  <Badge key={persona} variant="outline" className="text-xs">
                    {persona}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>
        <main className="container mx-auto p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Your Tests</h1>
              <p className="text-muted-foreground mt-2">Manage and review your usability tests</p>
            </div>
            <Link href="/dashboard/tests/new">
              <Button size="lg" className="h-11">
                New Test
              </Button>
            </Link>
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-muted">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="running">Running</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {tests.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Target className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">No tests yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Create your first test in 2 minutes
                      </p>
                    </div>
                    <Link href="/dashboard/tests/new">
                      <Button size="lg" className="mt-4">
                        New Test
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                tests.map((test) => <TestCard key={test.id} test={test} />)
              )}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-8">
              {tests.filter((t) => t.status === "draft").length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Target className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">No drafts yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Create your first test in 2 minutes
                      </p>
                    </div>
                    <Link href="/dashboard/tests/new">
                      <Button size="lg" className="mt-4">
                        New Test
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                tests
                  .filter((t) => t.status === "draft")
                  .map((test) => <TestCard key={test.id} test={test} />)
              )}
            </TabsContent>

            <TabsContent value="running" className="space-y-8">
              {tests.filter((t) => t.status === "running" || t.status === "queued").length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Target className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">No running tests</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Tests will appear here while they&apos;re running
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                tests
                  .filter((t) => t.status === "running" || t.status === "queued")
                  .map((test) => <TestCard key={test.id} test={test} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {tests.filter((t) => t.status === "completed").length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Target className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">No completed tests</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Completed tests will appear here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                tests
                  .filter((t) => t.status === "completed")
                  .map((test) => <TestCard key={test.id} test={test} />)
              )}
            </TabsContent>
          </Tabs>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete test?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the test and all
                  associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </AppLayout>
    </div>
  );
}
