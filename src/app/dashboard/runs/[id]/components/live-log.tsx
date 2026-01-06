"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../../components/ui/button";
import { ChevronDown } from "lucide-react";
import { formatTimeStandard } from "../../../../../lib/utils/time-format";

interface LogEntry {
  t: number;
  text: string;
  type?: "reasoning" | "action";
}

interface LiveLogProps {
  logs: LogEntry[];
  startTime?: number;
}

export function LiveLog({ logs, startTime }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Console debug: Log when component renders or logs change
  useEffect(() => {
    console.log("[LiveLog] Component rendered/updated", {
      logsCount: logs.length,
      startTime,
      logs: logs.map((log, idx) => ({
        index: idx,
        t: log.t,
        text: log.text?.substring(0, 100) || "NO TEXT",
        textLength: log.text?.length || 0,
        type: log.type || "undefined",
        fullLog: log,
      })),
      firstLog: logs[0] || null,
      lastLog: logs[logs.length - 1] || null,
    });
  }, [logs, startTime]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  // Use standardized time formatter
  // Logs use milliseconds relative to startTime

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto pr-2"
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <div>No logs yet</div>
            <div className="text-xs mt-1">Waiting for simulation to start...</div>
          </div>
        ) : (
          logs.map((log, index) => {
            const isReasoning = log.type === "reasoning";
            const isAction = log.type === "action";

            // Console debug: Log each log entry being rendered
            console.log(`[LiveLog] Rendering log entry ${index}`, {
              index,
              log,
              isReasoning,
              isAction,
              hasText: !!log.text,
              textLength: log.text?.length || 0,
              textPreview: log.text?.substring(0, 50) || "NO TEXT",
              timestamp: log.t,
            });

            // Check if this is a persona message (has "I" or first-person language)
            const isPersonaMessage =
              isReasoning || (log.text && /^I\s|^As\s|^I'm\s|^I've\s/i.test(log.text));

            return (
              <div
                key={index}
                className={`p-2 rounded flex gap-3 ${
                  isPersonaMessage
                    ? "bg-orange-50 dark:bg-orange-950/20 border-l-2 border-orange-500"
                    : isAction
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-muted/50 text-muted-foreground"
                }`}
                data-testid={`log-line-${index}`}
                data-log-time={log.t}
              >
                <span className="text-xs text-muted-foreground/70 shrink-0">
                  {formatTimeStandard(log.t)}
                </span>
                <span
                  className={`flex-1 ${isPersonaMessage ? "text-sm leading-relaxed italic" : ""}`}
                >
                  {log.text || "[NO TEXT]"}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!autoScroll && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <Button size="sm" variant="secondary" onClick={scrollToBottom} className="shadow-lg">
            <ChevronDown className="h-4 w-4 mr-2" />
            Jump to Live
          </Button>
        </div>
      )}
    </div>
  );
}
