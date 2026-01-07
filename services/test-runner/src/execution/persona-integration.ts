/**
 * Persona Integration
 *
 * Builds persona-specific system prompts and act() instructions
 */

import { OpenAI } from "openai";
import type { Persona } from "../utils/types.js";
import type { ConnectionConfig } from "../config/connections.js";

/**
 * Build persona system prompt for agent
 */
export function buildPersonaSystemPrompt(persona: Persona): string {
  let prompt = `You are ${persona.name}`;

  if (persona.role) {
    prompt += `, ${persona.role}`;
  }

  prompt += ".\n\n";

  if (persona.goals && persona.goals.length > 0) {
    prompt += `Goals: ${persona.goals.join(", ")}\n`;
  }

  if (persona.behaviors && persona.behaviors.length > 0) {
    prompt += `Behaviors: ${persona.behaviors.join(", ")}\n`;
  }

  if (persona.frustrations && persona.frustrations.length > 0) {
    prompt += `Frustrations: ${persona.frustrations.join(", ")}\n`;
  }

  if (persona.constraints && persona.constraints.length > 0) {
    prompt += `Constraints: ${persona.constraints.join(", ")}\n`;
  }

  if (persona.accessibility && persona.accessibility.length > 0) {
    prompt += `Accessibility needs: ${persona.accessibility.join(", ")}\n`;
  }

  prompt +=
    "\nWhen interacting with the interface, think and act as this persona would. Explain your actions and reasoning as this persona would, using first-person language.";

  return prompt;
}

/**
 * Check if a task is likely already atomic (simple heuristic)
 */
function isLikelyAtomic(task: string): boolean {
  // Simple heuristic: tasks without "and", "then", "," are likely atomic
  const multiStepIndicators = /\b(and|then|after|before|also|plus|,\s)/i;
  return !multiStepIndicators.test(task) && task.length < 50;
}

/**
 * Build persona-enhanced act() instruction with OpenAI rephrasing
 *
 * Rephrases tasks into atomic, specific instructions optimized for Stagehand
 */
export async function buildPersonaActInstruction(
  task: string,
  persona: Persona,
  config: ConnectionConfig
): Promise<string> {
  // Simple heuristic: if task looks atomic, return as-is (optimization)
  if (isLikelyAtomic(task)) {
    return task;
  }

  // Use OpenAI to rephrase task
  const openai = new OpenAI({ apiKey: config.openai.apiKey });

  const systemPrompt = `You are a task optimization assistant. Transform user tasks into atomic, specific instructions for browser automation.

Guidelines:
- Make instructions atomic (one action at a time)
- Be specific about what to click/type/select
- Remove multi-step language ("and", "then", "after")
- Keep the core intent of the task
- Use clear, direct language

Examples:
Input: "Add item to cart and checkout"
Output: "Click the 'Add to Cart' button"

Input: "Fill out the contact form"
Output: "Fill out all required fields in the contact form"

Persona context: ${persona.name}, ${persona.role}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Rephrase this task into an atomic, specific instruction: "${task}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const rephrased = response.choices[0]?.message?.content?.trim() || task;
    return rephrased;
  } catch (error) {
    // If rephrasing fails, return original task (graceful degradation)
    console.warn("Task rephrasing failed, using original task:", error);
    return task;
  }
}

/**
 * Format agent result message as first-person persona explanation
 */
export function formatPersonaExplanation(message: string | unknown, _persona: Persona): string {
  // Convert message to string if it's not already
  let messageStr: string;
  if (typeof message === "string") {
    messageStr = message;
  } else if (message === null || message === undefined) {
    messageStr = "I'm processing this step...";
  } else if (typeof message === "object") {
    // Try to extract a meaningful string from the object
    messageStr = JSON.stringify(message);
  } else {
    messageStr = String(message);
  }

  // Skip empty or meaningless messages
  if (
    !messageStr ||
    messageStr.trim().length === 0 ||
    messageStr.trim() === "[]" ||
    messageStr.trim() === "{}"
  ) {
    return ""; // Return empty string for empty messages
  }

  // Ensure first-person perspective
  // Replace "The agent" with "I", "It" with "I", etc.
  let explanation = messageStr
    .replace(/^The agent /i, "I ")
    .replace(/^It /i, "I ")
    .replace(/^Agent /i, "I ")
    .replace(/\bthe agent\b/gi, "I")
    .replace(/\bthe system\b/gi, "the interface")
    .replace(/^As\s+\w+\s*,\s*/i, "") // Remove "As PersonaName, " prefix if already present
    .replace(/:\s*$/g, "") // Remove trailing colons
    .trim();

  // Don't add persona context prefix - make it natural first-person speech
  // Only add context if the message is very generic and short
  if (explanation.length < 20 && !explanation.match(/^I\s/i)) {
    explanation = `I'm ${explanation.toLowerCase()}`;
  }

  // Ensure it starts with "I" for first-person
  if (!explanation.match(/^I\s/i) && explanation.length > 0) {
    explanation = `I ${explanation.toLowerCase()}`;
  }

  return explanation;
}
