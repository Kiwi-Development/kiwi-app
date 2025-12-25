import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

const waitlistSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = waitlistSchema.parse(body);

    // Check if Google Sheets is configured
    if (
      !env.googleSheets.clientEmail ||
      !env.googleSheets.privateKey ||
      !env.googleSheets.spreadsheetId
    ) {
      return NextResponse.json(
        { error: "Google Sheets integration not configured" },
        { status: 503 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: env.googleSheets.clientEmail,
        private_key: env.googleSheets.privateKey.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.googleSheets.spreadsheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[email, new Date().toISOString()]],
      },
    });

    return NextResponse.json({ message: "Success" }, { status: 200 });
  } catch (error) {
    console.error("Waitlist error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
