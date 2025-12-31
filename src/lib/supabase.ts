import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

// Use the browser client that properly handles sessions
// This is safe to use in client components and stores
export const supabase = createPagesBrowserClient();
