"use client";

import type React from "react";

import type { RunEvent } from "@/lib/types";
import { Badge } from "../../../../../components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../../components/ui/tooltip";
import {
  MousePointerClick,
  Send,
  ArrowLeft,
  AlertCircle,
  Zap,
  AlertTriangle,
  Focus,
} from "lucide-react";

interface EventTimelineProps {
  events: RunEvent[];
  onEventClick: (event: RunEvent) => void;
  highlightedEventId?: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  click: <MousePointerClick className="h-3 w-3" />,
  submit: <Send className="h-3 w-3" />,
  backtrack: <ArrowLeft className="h-3 w-3" />,
  error: <AlertCircle className="h-3 w-3" />,
  rage: <Zap className="h-3 w-3" />,
  "copy-risk": <AlertTriangle className="h-3 w-3" />,
  "focus-trap": <Focus className="h-3 w-3" />,
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

export function EventTimeline({ events, onEventClick, highlightedEventId }: EventTimelineProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <TooltipProvider>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {events.map((event) => (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEventClick(event)}
                className={`flex-shrink-0 transition-all ${
                  highlightedEventId === event.id ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                data-testid={`timeline-event-${event.id}`}
                aria-label={`${event.label} at ${formatTime(event.t)}`}
              >
                <Badge
                  variant={eventVariants[event.type] || "secondary"}
                  className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:opacity-80"
                >
                  {eventIcons[event.type]}
                  <span className="text-xs font-mono">{formatTime(event.t)}</span>
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1 max-w-xs">
                <p className="font-semibold">{event.label}</p>
                {event.details && <p className="text-muted-foreground">{event.details}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
