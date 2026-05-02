/**
 * CRAG Generator — mirrors generator.py
 *
 * Calls the Python Flask microservice (app.py) which uses Ollama (qwen2.5:3b)
 * to generate an answer given the corrected context documents.
 * The raw answer is then polished by the configured LLM (Gemini/Groq/Euri)
 * into clean, LaTeX-formatted markdown.
 *
 * Run Flask before starting the dev server: `npm run flask` or `python app.py`
 */

import { AIClient } from "../ai-client";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RetrievedDoc } from "./retriever";
import type { APISettings } from "../types";

const FLASK_BASE_URL = process.env.CRAG_FLASK_URL ?? "http://localhost:5001";

export interface GeneratorResult {
  answer: string;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Use the configured LLM to rewrite the raw Ollama output into clean
 * LaTeX-formatted markdown that is accurate to the source context.
 * Includes prior conversation turns so the model has context.
 */
async function polishWithLLM(
  query: string,
  rawAnswer: string,
  context: string,
  history: HistoryTurn[],
  userSettings?: APISettings,
): Promise<string> {
  try {
    const client = new AIClient(undefined, 0.3, userSettings);

    // Build a compact history block (last 6 turns to stay within context)
    const recentHistory = history.slice(-6);
    const historyBlock =
      recentHistory.length > 0
        ? `\nPrevious conversation (for context only — do NOT repeat it):\n${recentHistory
            .map(
              (t) =>
                `${t.role === "user" ? "Student" : "Tutor"}: ${t.content.slice(0, 400)}`,
            )
            .join("\n")}\n`
        : "";

    const response = await client.invoke([
      new SystemMessage(
        `You are a study assistant. Your job is to take a raw, compressed answer from a retrieval model and rewrite it as a clear, well-formatted response.

Rules:
- Use LaTeX for ALL mathematical expressions: inline with $...$ and display with $$...$$
- Format as clean markdown (headers, bullet points where helpful)
- Do NOT add information not present in the context or raw answer
- Do NOT say "Based on the context" or similar — respond directly
- Keep it concise and educational
- Use the conversation history to understand what has already been explained and avoid repetition`,
      ),
      new HumanMessage(
        `${historyBlock}
Student question: ${query}

Retrieved context:
${context}

Raw model answer (may be garbled or compressed):
${rawAnswer}

Rewrite the answer in clean, readable markdown with proper LaTeX formatting:`,
      ),
    ]);
    return response.content.trim() || rawAnswer;
  } catch (err) {
    // If LLM is unavailable, fall back to raw T5 answer
    console.warn(
      "[CRAG Generator] LLM polish failed, using raw T5 output:",
      err,
    );
    return rawAnswer;
  }
}

/**
 * POST query + corrected docs to the Flask /api/generate endpoint.
 * Ollama (qwen2.5:3b) on the Python side produces the answer,
 * which is then polished by the local LLM into formatted markdown with LaTeX.
 */
export async function generateAnswer(
  query: string,
  docs: RetrievedDoc[],
  userSettings?: APISettings,
  history: HistoryTurn[] = [],
): Promise<GeneratorResult> {
  const docTexts = docs.map((d) => d.text);

  const res = await fetch(`${FLASK_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, docs: docTexts }),
    // Generous timeout — first Ollama call may be slow (model warmup)
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`CRAG generator error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { answer: string };
  const rawAnswer = data.answer ?? "";

  console.log("[CRAG Ollama] Raw model output:", rawAnswer);
  console.log(
    "[CRAG Ollama] Using user API key:",
    !!(
      userSettings?.apiKeys?.gemini ||
      userSettings?.apiKeys?.euri ||
      userSettings?.apiKeys?.groq
    ),
    userSettings?.primaryProvider
      ? `(provider: ${userSettings.primaryProvider})`
      : "(provider: default/env)",
  );

  // Polish the T5 output with the LLM for clean LaTeX markdown
  const context = docTexts.join("\n\n").substring(0, 3000);
  const polished = await polishWithLLM(
    query,
    rawAnswer,
    context,
    history,
    userSettings,
  );

  return { answer: polished };
}
