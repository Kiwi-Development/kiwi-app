/**
 * Task Executor
 *
 * Executes tasks using Stagehand v3 with observe+act pattern (best practice)
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type { ConnectionConfig } from "../config/connections.js";
import type { Persona, TaskResult } from "../utils/types.js";
import {
  buildPersonaSystemPrompt,
  buildPersonaActInstruction,
  formatPersonaExplanation,
} from "./persona-integration.js";

/**
 * Execute a single task using hybrid approach (observe+act with agent fallback)
 *
 * Best Practice: Use observe() first to plan actions (2-3x faster than direct act())
 */
export async function executeTask(
  task: string,
  persona: Persona,
  stagehand: Stagehand,
  config: ConnectionConfig,
  onPersonaMessage?: (message: string) => void
): Promise<TaskResult> {
  const startTime = Date.now();

  // Rephrase task once for all methods (optimization)
  const personaInstruction = await buildPersonaActInstruction(task, persona, config);

  try {
    // BEST PRACTICE: Use observe() first to plan the action
    // This is 2-3x faster than direct act() calls (per AGENTS.md)
    if (onPersonaMessage) {
      onPersonaMessage(`I'm analyzing the page to find: ${task}`);
    }

    const actions = await stagehand.observe(personaInstruction);

    if (actions.length > 0) {
      // Emit message about what we're going to do
      if (onPersonaMessage && actions[0].description) {
        onPersonaMessage(`I'm going to ${actions[0].description.toLowerCase()}`);
      }

      // Execute the first action (observe+act pattern)
      await stagehand.act(actions[0]);

      if (onPersonaMessage) {
        onPersonaMessage(
          `I successfully ${actions[0].description?.toLowerCase() || "completed the action"}`
        );
      }

      return {
        success: true,
        method: "observe-act",
        duration: Date.now() - startTime,
      };
    }

    // If observe() returns no actions, try direct act() with persona context
    if (onPersonaMessage) {
      onPersonaMessage(`I'm attempting to: ${task}`);
    }

    await stagehand.act(personaInstruction, { timeout: 10000 });

    if (onPersonaMessage) {
      onPersonaMessage(`I completed: ${task}`);
    }

    return {
      success: true,
      method: "act",
      duration: Date.now() - startTime,
    };
  } catch (error: unknown) {
    // Fallback to agent for complex tasks
    try {
      // Configure model with API key if provided
      const modelConfig = config.model.apiKey
        ? {
            modelName: config.model.name,
            apiKey: config.model.apiKey,
          }
        : config.model.name;

      const agent = stagehand.agent({
        systemPrompt: buildPersonaSystemPrompt(persona),
        model: modelConfig,
        stream: true, // Enable streaming for real-time persona messages
      });

      const streamResult = await agent.execute({
        instruction: personaInstruction,
        highlightCursor: true,
        maxSteps: 20,
        callbacks: {
          onStepFinish: (event: any) => {
            // Capture persona messages from agent reasoning
            // event.reasoning contains the agent's reasoning for this step
            if (event.reasoning && onPersonaMessage) {
              try {
                const personaMessage = formatPersonaExplanation(event.reasoning, persona);
                // Only send non-empty messages
                if (personaMessage && personaMessage.trim().length > 0) {
                  onPersonaMessage(personaMessage);
                }
              } catch (error) {
                console.warn("Error formatting persona message in onStepFinish:", error);
              }
            }
          },
        },
      });

      // Process streaming text in real-time for persona messages
      // This runs in parallel with the agent execution for real-time updates
      if (onPersonaMessage) {
        // Start processing stream in background (don't await - we want real-time updates)
        (async () => {
          let accumulatedText = "";
          let lastEmitTime = Date.now();
          const EMIT_INTERVAL_MS = 500; // Emit every 500ms or when we hit a sentence boundary

          try {
            for await (const delta of streamResult.textStream) {
              accumulatedText += delta;
              const now = Date.now();
              const timeSinceLastEmit = now - lastEmitTime;

              // Emit if we have a complete sentence (ending with punctuation) or every 500ms
              const hasCompleteSentence = /[.!?]\s*$/.test(accumulatedText.trim());
              const shouldEmit = hasCompleteSentence || timeSinceLastEmit >= EMIT_INTERVAL_MS;

              if (shouldEmit && accumulatedText.trim().length > 5) {
                // Extract the latest complete thought
                const sentences = accumulatedText.match(/[^.!?]+[.!?]+/g);
                if (sentences && sentences.length > 0) {
                  // Emit the last complete sentence(s)
                  const textToEmit = sentences.slice(-1)[0].trim();
                  if (textToEmit.length > 5) {
                    const personaMessage = formatPersonaExplanation(textToEmit, persona);
                    // Only send non-empty messages
                    if (personaMessage && personaMessage.trim().length > 0) {
                      onPersonaMessage(personaMessage);
                    }
                    // Remove processed text
                    accumulatedText = accumulatedText.slice(
                      accumulatedText.lastIndexOf(sentences[sentences.length - 1]) +
                        sentences[sentences.length - 1].length
                    );
                    lastEmitTime = now;
                  }
                } else if (
                  timeSinceLastEmit >= EMIT_INTERVAL_MS &&
                  accumulatedText.trim().length > 20
                ) {
                  // Emit accumulated text if it's been a while and we have enough content
                  const textToEmit = accumulatedText.trim();
                  const personaMessage = formatPersonaExplanation(textToEmit, persona);
                  // Only send non-empty messages
                  if (personaMessage && personaMessage.trim().length > 0) {
                    onPersonaMessage(personaMessage);
                  }
                  accumulatedText = "";
                  lastEmitTime = now;
                }
              }
            }

            // Emit any remaining text
            if (accumulatedText.trim().length > 5) {
              const personaMessage = formatPersonaExplanation(accumulatedText.trim(), persona);
              // Only send non-empty messages
              if (personaMessage && personaMessage.trim().length > 0) {
                onPersonaMessage(personaMessage);
              }
            }
          } catch (err) {
            console.warn("Error processing text stream:", err);
          }
        })();
      }

      // Get the final result after streaming completes
      const result = await streamResult.result;

      // Check if task was completed successfully
      if (result.success === true && result.completed === true) {
        return {
          success: true,
          method: "agent",
          duration: Date.now() - startTime,
        };
      } else {
        // Agent couldn't complete the task (got stuck)
        // Extract persona explanation from result.message
        const personaExplanation = formatPersonaExplanation(
          result.message || "I was unable to complete this task.",
          persona
        );

        // Emit persona message if callback provided
        if (onPersonaMessage) {
          onPersonaMessage(personaExplanation);
        }

        return {
          success: false,
          method: "agent",
          duration: Date.now() - startTime,
          personaExplanation: personaExplanation,
          error: "Task incomplete: Agent unable to complete task",
        };
      }
    } catch (agentError: unknown) {
      // Agent threw an error (different from getting stuck)
      const message = agentError instanceof Error ? agentError.message : String(agentError);
      return {
        success: false,
        method: "agent",
        duration: Date.now() - startTime,
        error: message, // Error, not persona explanation
      };
    }
  }
}
