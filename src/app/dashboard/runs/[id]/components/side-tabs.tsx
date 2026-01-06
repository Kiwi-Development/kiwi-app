"use client";

import type React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { Badge } from "../../../../../components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface Task {
  index: number;
  title: string;
  pass?: boolean;
  duration?: number;
}

interface SideTabsProps {
  tasks: Task[];
  consoleTrace: unknown[];
}

export function SideTabs({ tasks, consoleTrace }: SideTabsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Tabs defaultValue="tasks" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="tasks" className="flex-1">
          Tasks
        </TabsTrigger>
        <TabsTrigger value="console" className="flex-1">
          Console
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="space-y-3 mt-4">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tasks will appear here during the run
          </p>
        ) : (
          tasks.map((task) => (
            <div key={task.index} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{task.title}</h4>
                {task.pass !== undefined && (
                  <Badge
                    variant={task.pass ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {task.pass ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Pass
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Fail
                      </>
                    )}
                  </Badge>
                )}
              </div>
              {task.duration !== undefined && (
                <p className="text-sm text-muted-foreground">Duration: {formatTime(task.duration)}</p>
              )}
            </div>
          ))
        )}
      </TabsContent>

      <TabsContent value="console" className="mt-4">
        <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
          {consoleTrace.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Technical logs will appear here during the run
            </p>
          ) : (
            consoleTrace.map((trace: any, index) => {
              // Format technical messages (exclude persona/agent reasoning messages)
              const formatConsoleMessage = (trace: any): string | null => {
                if (typeof trace === 'string') {
                  // Skip persona messages in console
                  if (trace.includes("I'm") || trace.includes("I am") || trace.includes("As ") || /^I\s/.test(trace)) {
                    return null; // Don't show persona messages in console
                  }
                  return trace;
                }
                
                // Skip persona-related messages
                if (trace.type === 'persona_message' || trace.type === 'reasoning') {
                  return null;
                }
                
                if (trace.type === 'session_init') {
                  return `🔌 Initializing browser session...`;
                }
                
                if (trace.type === 'session_created') {
                  return `✅ Browser session created (ID: ${trace.sessionId?.substring(0, 8)}...)`;
                }
                
                if (trace.type === 'session_error') {
                  return `❌ Session error: ${trace.error || trace.message || 'Unknown error'}`;
                }
                
                if (trace.type === 'action_result') {
                  const parts = [];
                  if (trace.agentUsed) {
                    parts.push('🤖 Agent used');
                  }
                  if (trace.success !== undefined) {
                    parts.push(trace.success ? '✓ Success' : '✗ Failed');
                  }
                  if (trace.selector) {
                    parts.push(`Selector: ${trace.selector.substring(0, 50)}...`);
                  }
                  return parts.length > 0 ? parts.join(' | ') : 'Action executed';
                }
                
                if (trace.type === 'technical_message' || trace.type === 'log') {
                  return `📋 ${trace.message || 'Technical message'}`;
                }
                
                // Fallback: show message or type (only if not persona-related)
                const message = trace.message || trace.type || 'Technical log';
                if (message.includes("I'm") || message.includes("I am") || message.includes("As ")) {
                  return null; // Skip persona messages
                }
                return message;
              };
              
              const formatTime = (timestamp: string | number) => {
                try {
                  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
                  return date.toLocaleTimeString();
                } catch {
                  return '';
                }
              };
              
              const formatted = formatConsoleMessage(trace);
              if (!formatted) {
                return null; // Don't render persona messages in console
              }
              
              return (
                <div
                  key={index}
                  className="bg-muted/50 p-2 rounded border-l-2 border-muted-foreground/20"
                >
                  <div className="flex items-start gap-2">
                    {(trace.timestamp || trace.t) && (
                      <span className="text-muted-foreground/70 shrink-0">
                        {formatTime(trace.timestamp || trace.t)}
                      </span>
                    )}
                    <span className="flex-1 text-foreground">
                      {formatted}
                    </span>
                  </div>
                </div>
              );
            }).filter((item): item is React.ReactElement => item !== null) // Remove null entries
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
