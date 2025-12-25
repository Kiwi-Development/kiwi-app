/**
 * Environment variable validation and access
 * Ensures required environment variables are present at startup
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please check your .env.local file. See .env.example for reference.`
    );
  }

  return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

// Validate required environment variables on module load
export const env = {
  // Supabase (Required)
  supabase: {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },

  // OpenAI (Required)
  openai: {
    apiKey: getEnv("OPENAI_API_KEY"),
    model: getOptionalEnv("OPENAI_MODEL", "gpt-4o") as string,
  },

  // Backend (Optional, with defaults)
  backend: {
    ip: getOptionalEnv("NEXT_PUBLIC_EC2_IP", "localhost"),
    port: getOptionalEnv("NEXT_PUBLIC_BACKEND_PORT", "5001"),
  },

  // Google Sheets (Optional)
  googleSheets: {
    clientEmail: getOptionalEnv("GOOGLE_SHEETS_CLIENT_EMAIL"),
    privateKey: getOptionalEnv("GOOGLE_SHEETS_PRIVATE_KEY"),
    spreadsheetId: getOptionalEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
  },
} as const;

// Validate on server-side only
if (typeof window === "undefined") {
  try {
    // This will throw if required vars are missing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = env.supabase.url;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const __ = env.supabase.anonKey;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ___ = env.openai.apiKey;
  } catch (error) {
    console.error("\n❌ Environment Configuration Error:");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nPlease check your .env.local file.\n");
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}
