"use client";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { useState, useEffect } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  useEffect(() => {
    // Suppress browser extension errors that don't affect the app
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || "";
      // Suppress common browser extension errors
      if (
        errorMessage.includes("message channel closed") ||
        errorMessage.includes("asynchronous response") ||
        errorMessage.includes("Extension context invalidated")
      ) {
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || "");
      // Suppress common browser extension errors
      if (
        reason.includes("message channel closed") ||
        reason.includes("asynchronous response") ||
        reason.includes("Extension context invalidated")
      ) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>{children}</SessionContextProvider>
  );
}
