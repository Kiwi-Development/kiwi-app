"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import {
  MousePointerClick,
  Send,
  ArrowLeft,
  AlertCircle,
  Zap,
  AlertTriangle,
  Focus,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "../../../../../lib/supabase";
import { formatTimeStandard } from "../../../../../lib/utils/time-format";

interface ActionEvent {
  id: string;
  type: string;
  label: string;
  details?: string;
  timestamp: number; // in seconds
  screenshotIndex?: number;
  screenshotUrl?: string;
  personaReasoning?: string;
  testRunId: string;
}

interface ActionJourneyProps {
  events: ActionEvent[];
  testRunId: string;
  logs?: Array<{ t: number; text: string; type?: "reasoning" | "action" }>;
}

const eventIcons: Record<string, React.ReactNode> = {
  click: <MousePointerClick className="h-4 w-4" />,
  submit: <Send className="h-4 w-4" />,
  backtrack: <ArrowLeft className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  rage: <Zap className="h-4 w-4" />,
  "copy-risk": <AlertTriangle className="h-4 w-4" />,
  "focus-trap": <Focus className="h-4 w-4" />,
};

const eventVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  click: "secondary",
  submit: "default",
  backtrack: "outline",
  error: "destructive",
  rage: "destructive",
  "copy-risk": "outline",
  "focus-trap": "destructive",
};

export function ActionJourney({ events, testRunId, logs }: ActionJourneyProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<Record<number, string>>({});

  // Fetch screenshot URLs
  const fetchScreenshot = async (screenshotIndex: number) => {
    if (screenshotUrls[screenshotIndex]) {
      return screenshotUrls[screenshotIndex];
    }

    try {
      const fileName = `${testRunId}/screenshots/${screenshotIndex}.png`;
      const { data, error } = await supabase.storage
        .from("test-evidence")
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (error) {
        console.warn(`Failed to fetch screenshot ${screenshotIndex}:`, error);
        return null;
      }

      if (data?.signedUrl) {
        setScreenshotUrls((prev) => ({ ...prev, [screenshotIndex]: data.signedUrl }));
        return data.signedUrl;
      }
    } catch (error) {
      console.warn(`Error fetching screenshot ${screenshotIndex}:`, error);
    }

    return null;
  };

  // Get persona reasoning for an event (find closest log entry by timestamp)
  const getPersonaReasoning = (eventTimestamp: number): string | undefined => {
    if (!logs || logs.length === 0) return undefined;

    // Find the closest reasoning log entry before or at this timestamp
    const eventTimeMs = eventTimestamp * 1000; // Convert to milliseconds
    const reasoningLogs = logs.filter(
      (log) => log.type === "reasoning" && log.t <= eventTimeMs
    );

    if (reasoningLogs.length === 0) return undefined;

    // Get the most recent reasoning before this event
    const closestLog = reasoningLogs[reasoningLogs.length - 1];
    return closestLog.text;
  };

  // Use standardized time formatter
  // Events use seconds, formatTimeStandard handles it

  const handleEventClick = async (event: ActionEvent) => {
    if (expandedEventId === event.id) {
      setExpandedEventId(null);
      return;
    }

    setExpandedEventId(event.id);

    // Fetch screenshot if available
    if (event.screenshotIndex !== undefined) {
      await fetchScreenshot(event.screenshotIndex);
    }
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No actions recorded yet. Actions will appear here as the persona interacts with the interface.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Journey</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => {
            const isExpanded = expandedEventId === event.id;
            const screenshotUrl = event.screenshotIndex !== undefined 
              ? screenshotUrls[event.screenshotIndex] 
              : null;
            const personaReasoning = getPersonaReasoning(event.timestamp);

            return (
              <div
                key={event.id}
                className="relative border-l-2 border-muted pl-4 pb-4 last:border-l-0 last:pb-0"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-2 border-background" />

                {/* Event content */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge
                        variant={eventVariants[event.type] || "secondary"}
                        className="flex items-center gap-1.5"
                      >
                        {eventIcons[event.type]}
                        <span className="text-xs">{event.label}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTimeStandard(event.timestamp)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEventClick(event)}
                      className="h-8"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {event.details && (
                    <p className="text-sm text-muted-foreground">{event.details}</p>
                  )}

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="space-y-4 pt-2 border-t border-muted">
                      {/* Persona Reasoning */}
                      {personaReasoning && (
                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border-l-2 border-orange-500">
                          <p className="text-xs font-semibold text-orange-900 dark:text-orange-100 mb-1">
                            Persona Thinking
                          </p>
                          <p className="text-sm italic text-orange-800 dark:text-orange-200">
                            {personaReasoning}
                          </p>
                        </div>
                      )}

                      {/* Screenshot */}
                      {event.screenshotIndex !== undefined && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                            <span>Screenshot at this moment</span>
                          </div>
                          {screenshotUrl ? (
                            <div className="rounded-lg border border-border overflow-hidden bg-muted/50">
                              <img
                                src={screenshotUrl}
                                alt={`Screenshot at ${formatTimeStandard(event.timestamp)}`}
                                className="w-full h-auto"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
                              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Loading screenshot...</p>
                            </div>
                          )}
                        </div>
                      )}

                      {!personaReasoning && event.screenshotIndex === undefined && (
                        <p className="text-sm text-muted-foreground italic">
                          No additional details available for this action.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

