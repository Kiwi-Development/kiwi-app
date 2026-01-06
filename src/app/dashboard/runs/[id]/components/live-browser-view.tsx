"use client";

import { useEffect, useRef } from "react";

interface LiveBrowserViewProps {
  sessionReady: boolean;
  liveViewUrl?: string;
}

export function LiveBrowserView({ sessionReady, liveViewUrl }: LiveBrowserViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Show iframe immediately if we have a URL (don't wait for sessionReady)
    if (liveViewUrl && iframeRef.current) {
      // Ensure navbar=false is in the URL
      const url = new URL(liveViewUrl);
      url.searchParams.set("navbar", "false");
      iframeRef.current.src = url.toString();
    }
  }, [liveViewUrl]);

  useEffect(() => {
    // Hide scrollbar by injecting CSS when iframe loads
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        // Try to access iframe content (may fail due to CORS)
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const style = iframeDoc.createElement("style");
          style.textContent = `
            ::-webkit-scrollbar { display: none; }
            * { scrollbar-width: none; }
            body { overflow: -moz-scrollbars-none; }
          `;
          iframeDoc.head.appendChild(style);
        }
      } catch (error) {
        // CORS error - can't access iframe content, which is expected for cross-origin iframes
        // The scrollbar hiding will need to be done server-side or via URL parameters
        console.debug("Cannot access iframe content (CORS):", error);
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [liveViewUrl]);

  // Show iframe if we have a URL, otherwise show loading state
  if (!liveViewUrl) {
    return (
      <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center text-muted-foreground">
        <p>Waiting for browser session...</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        allow="camera; microphone; geolocation"
        title="Live Browser View"
      />
    </div>
  );
}
