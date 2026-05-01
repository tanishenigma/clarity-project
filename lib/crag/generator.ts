/**
 * CRAG Generator — mirrors generator.py
 *
 * Calls the Python Flask microservice (app.py) which loads the fine-tuned
 * T5 Large model to generate an answer given the corrected context documents.
 * The raw T5 output is then polished by the configured LLM (Gemini/Groq/Euri)
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

/**
 * Use the configured LLM to rewrite the raw T5 output into clean
 * LaTeX-formatted markdown that is accurate to the source context.
 */
async function polishWithLLM(
  query: string,
  rawAnswer: string,
  context: string,
  userSettings?: APISettings,
): Promise<string> {
  try {
    const client = new AIClient(undefined, 0.3, userSettings);
    const response = await client.invoke([
      new SystemMessage(
        `You are a study assistant. Your job is to take a raw, compressed answer from a retrieval model and rewrite it as a clear, well-formatted response.

Rules:
- Use LaTeX for ALL mathematical expressions: inline with $...$ and display with $$...$$
- Format as clean markdown (headers, bullet points where helpful)
- Do NOT add information not present in the context or raw answer
- Do NOT say "Based on the context" or similar — respond directly
- Keep it concise and educational`,
      ),
      new HumanMessage(
        `Student question: ${query}

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
 * The fine-tuned T5 Large model on the Python side produces the final answer,
 * which is then polished by the local LLM into formatted markdown with LaTeX.
 */
export async function generateAnswer(
  query: string,
  docs: RetrievedDoc[],
  userSettings?: APISettings,
): Promise<GeneratorResult> {
  const docTexts = docs.map((d) => d.text);

  const res = await fetch(`${FLASK_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, docs: docTexts }),
    // Generous timeout — T5 generation can be slow on first call (model warmup)
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`CRAG generator error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { answer: string };
  const rawAnswer = data.answer ?? "";

  console.log("[CRAG T5] Raw model output:", rawAnswer);
  console.log(
    "[CRAG T5] Using user API key:",
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
  const polished = await polishWithLLM(query, rawAnswer, context, userSettings);

  return { answer: polished };
}
