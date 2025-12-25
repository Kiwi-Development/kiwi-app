"use client";

import type { RunEvent } from "../model";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../../components/ui/tooltip";

interface MarkerBarProps {
  events: RunEvent[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

const eventColors: Record<string, string> = {
  click: "bg-blue-500",
  submit: "bg-green-500",
  error: "bg-red-500",
  rage: "bg-orange-500",
  backtrack: "bg-yellow-500",
  "copy-risk": "bg-purple-500",
  "focus-trap": "bg-pink-500",
};

export function MarkerBar({ events, duration, currentTime, onSeek }: MarkerBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (duration === 0) return null;

  return (
    <TooltipProvider>
      <div className="relative h-8 w-full">
        {events.map((event) => {
          const position = (event.t / duration) * 100;
          return (
            <Tooltip key={event.id}>
              <TooltipTrigger asChild>
                <button
                  className={`absolute top-0 w-1 h-full ${eventColors[event.type] || "bg-gray-500"} 
                    hover:w-2 transition-all cursor-pointer rounded-full`}
                  style={{ left: `${position}%` }}
                  onClick={() => onSeek(event.t)}
                  data-testid={`marker-${event.id}`}
                  aria-label={`Jump to ${event.label} at ${formatTime(event.t)}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p className="font-semibold">{event.label}</p>
                  <p className="text-muted-foreground">{formatTime(event.t)}</p>
                  {event.details && <p className="text-muted-foreground">{event.details}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
