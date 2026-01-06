/**
 * Hook for SSE streaming of test run updates
 */

import { useEffect, useRef, useState } from "react";

export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface UseTestRunStreamOptions {
  testRunId: string;
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

export function useTestRunStream({
  testRunId,
  onEvent,
  enabled = true,
}: UseTestRunStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !testRunId) {
      return;
    }

    // Create SSE connection
    const eventSource = new EventSource(`/api/test-runs/${testRunId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onEvent) {
          onEvent(data);
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      setError(new Error("SSE connection failed"));
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [testRunId, enabled, onEvent]);

  return {
    isConnected,
    error,
    close: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    },
  };
}

