"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface SessionReplayPlayerProps {
  sessionId: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/**
 * Session Replay Player Component
 * Uses rrweb-player to display Browserbase session recordings
 */
export function SessionReplayPlayer({ 
  sessionId, 
  collapsible = false, 
  defaultOpen = true 
}: SessionReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[] | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    let mounted = true;

    const loadRecording = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch recording events from API
        const response = await fetch(`/api/sessions/${sessionId}/recording`);

        if (!response.ok) {
          if (response.status === 404) {
            const data = await response.json().catch(() => ({}));
            const errorMessage = data.error || "Recording not available yet. Recordings are available about 30 seconds after session close.";
            
            // If we haven't exceeded max retries and the error suggests waiting, retry after a delay
            if (retryCount < maxRetries && errorMessage.includes("30 seconds")) {
              console.log(`Recording not ready yet, retrying in 5 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
              setTimeout(() => {
                if (mounted) {
                  setRetryCount(prev => prev + 1);
                }
              }, 5000);
              return;
            }
            
            setError(errorMessage);
          } else {
            setError("Failed to load recording");
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        
        if (!mounted) return;

        // data.events is an array of SessionRecording objects from Browserbase
        if (!data.events || !Array.isArray(data.events) || data.events.length === 0) {
          setError("No recording events found");
          setIsLoading(false);
          return;
        }

        setEvents(data.events);

        // Dynamically import rrweb-player (client-side only)
        const { default: rrwebPlayer } = await import("rrweb-player");
        // Import CSS - use type assertion to avoid TypeScript error
        try {
          await import("rrweb-player/dist/style.css" as any);
        } catch (cssError) {
          // CSS import might fail in some environments, but that's okay
          console.warn("Could not load rrweb-player CSS:", cssError);
        }

        if (!mounted || !containerRef.current) return;

        // Clean up existing player if any
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        // Initialize rrweb player
        playerRef.current = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events: data.events,
            width: containerRef.current.clientWidth || 1024,
            height: 576,
            skipInactive: true,
            showController: true,
            autoPlay: false,
          },
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading session replay:", err);
        if (mounted) {
          setError("Failed to load session replay");
          setIsLoading(false);
        }
      }
    };

    loadRecording();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
      }
    };
  }, [sessionId, retryCount]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Replay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[576px] bg-slate-100 dark:bg-slate-900 rounded-lg">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                {retryCount > 0 
                  ? `Waiting for recording to be available... (attempt ${retryCount + 1}/${maxRetries + 1})`
                  : "Loading session replay..."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Replay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[576px] bg-slate-100 dark:bg-slate-900 rounded-lg">
            <div className="text-center space-y-4 max-w-md">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Replay Not Available</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );

  if (collapsible) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle>Session Replay</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Replay of the session using rrweb events. Recordings are available about 30 seconds after session close.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="ml-4"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isOpen && <CardContent>{content}</CardContent>}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Replay</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Replay of the session using rrweb events. Recordings are available about 30 seconds after session close.
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

