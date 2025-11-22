import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const waitlistSchema = z.object({
    email: z.string().email(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email } = waitlistSchema.parse(body);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            },
            scopes: [
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/spreadsheets",
            ],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!spreadsheetId) {
            return NextResponse.json(
                { error: "Spreadsheet ID not configured" },
                { status: 500 }
            );
        }

        await sheets.spreadsheets.values.append({
            spreadsheetId,
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
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
