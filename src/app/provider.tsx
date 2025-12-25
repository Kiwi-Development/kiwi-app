"use client";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { useState } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>{children}</SessionContextProvider>
  );
}
