import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/personas/generate
 * Generate persona data from a natural language description using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 });
    }

    // Initialize OpenAI client with API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const prompt = `You are a UX researcher creating a detailed user persona. Based on the following description, generate a comprehensive persona profile.

Description: ${description}

Generate a persona with the following structure (return as JSON):
{
  "name": "Full name (e.g., Alex Chen)",
  "role": "Job title or role (e.g., Marketing Manager)",
  "tags": ["array", "of", "relevant", "tags"],
  "goals": ["Goal 1", "Goal 2", "Goal 3"],
  "behaviors": ["Behavior 1", "Behavior 2", "Behavior 3"],
  "frustrations": ["Frustration 1", "Frustration 2"],
  "constraints": ["Constraint 1", "Constraint 2"],
  "accessibility": ["Accessibility need 1", "Accessibility need 2"]
}

Available tags (use only relevant ones): Non-technical, Time-pressed, Keyboard-friendly, Mobile-first, Accessibility needs, Expert user, First-time user, Non-native English

Make the persona realistic, detailed, and specific. Return ONLY valid JSON, no markdown formatting or additional text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a UX researcher expert at creating detailed, realistic user personas. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Failed to generate persona" }, { status: 500 });
    }

    // Parse the JSON response
    let personaData;
    try {
      personaData = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Validate and normalize the response
    const normalizedPersona = {
      name: personaData.name || "",
      role: personaData.role || "",
      tags: Array.isArray(personaData.tags) ? personaData.tags : [],
      goals: Array.isArray(personaData.goals) ? personaData.goals : [],
      behaviors: Array.isArray(personaData.behaviors) ? personaData.behaviors : [],
      frustrations: Array.isArray(personaData.frustrations) ? personaData.frustrations : [],
      constraints: Array.isArray(personaData.constraints) ? personaData.constraints : [],
      accessibility: Array.isArray(personaData.accessibility) ? personaData.accessibility : [],
    };

    return NextResponse.json(normalizedPersona);
  } catch (error) {
    console.error("Error generating persona:", error);
    return NextResponse.json(
      {
        error: "Failed to generate persona",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
