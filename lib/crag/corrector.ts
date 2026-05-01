/**
 * CRAG Corrector
 *
 * Evaluates relevance of retrieved documents.
 * Decision logic (mirrors the CRAG paper):
 *   - HIGH confidence (avg score ≥ 0.4)  → use space docs as-is
 *   - LOW  confidence (avg score < 0.4)  → fall back to Tavily web search
 *
 * Tavily results are tagged source: "web" so the generator knows their origin.
 */

import type { RetrievedDoc } from "./retriever";

// TF-IDF cosine similarity scores are much lower than neural-embedding scores.
// A short natural-language query against dense technical text will typically
// score 0.01–0.15 even when semantically relevant, so 0.4 was always too high.
const THRESHOLD = 0.05;

// ── TF-IDF helpers (same as retriever) ───────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function buildTfVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const max = Math.max(...freq.values(), 1);
  const tf = new Map<string, number>();
  for (const [t, f] of freq) tf.set(t, f / max);
  return tf;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (const [term, w] of a) {
    dot += w * (b.get(term) ?? 0);
    normA += w * w;
  }
  for (const w of b.values()) normB += w * w;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Tavily web search ─────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<RetrievedDoc[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === "your_tavily_api_key") {
    console.warn(
      "[CRAG Corrector] TAVILY_API_KEY not set — skipping web search fallback",
    );
    return [];
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 4,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(8_000), // don't block for 30s on network issues
    });

    if (!res.ok) {
      console.error(
        "[CRAG Corrector] Tavily API error:",
        res.status,
        await res.text(),
      );
      return [];
    }

    const data: {
      results: Array<{ content: string; url: string; title?: string }>;
    } = await res.json();

    return (data.results ?? []).map((r) => ({
      text: r.content ?? "",
      source: "web" as const,
      score: 0.5, // neutral score — web results treated as moderate confidence
      title: r.title ?? r.url,
    }));
  } catch (err) {
    console.error("[CRAG Corrector] Tavily search error:", err);
    return [];
  }
}

// ── Public types & API ────────────────────────────────────────────────────────

export interface CorrectedContext {
  docs: RetrievedDoc[];
  confidence: number;
  usedWebSearch: boolean;
}

/**
 * Evaluate retrieved docs.
 *
 * Strategy: when space docs exist, always use them — the user is asking about
 * content they uploaded, so space docs are always the right primary source
 * regardless of TF-IDF keyword overlap (which breaks on conversational queries
 * like "what is this document about").
 *
 * Tavily web search is only triggered when there are NO space docs at all.
 */
export async function correctContext(
  query: string,
  retrievedDocs: RetrievedDoc[],
  threshold = THRESHOLD,
): Promise<CorrectedContext> {
  console.log(
    `[CRAG Corrector] Evaluating ${retrievedDocs.length} retrieved doc(s)`,
  );

  if (retrievedDocs.length === 0) {
    // No space content — try Tavily web search
    const webDocs = await webSearch(query);
    if (webDocs.length > 0) {
      console.log(
        `[CRAG Corrector] No space docs — using ${webDocs.length} Tavily result(s)`,
      );
      return { docs: webDocs, confidence: 0.5, usedWebSearch: true };
    }
    // Tavily also unavailable — return empty, generator will use query alone
    console.warn(
      "[CRAG Corrector] No space docs and no Tavily results — returning empty context",
    );
    return { docs: [], confidence: 0, usedWebSearch: false };
  }

  // Score docs for logging/ordering purposes only — not for filtering
  const queryVec = buildTfVector(tokenize(query));
  const scored = retrievedDocs.map((doc) => {
    const docVec = buildTfVector(tokenize(doc.text));
    return { doc, score: cosineSim(queryVec, docVec) };
  });

  const avgScore = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
  console.log(
    `[CRAG Corrector] Average doc score: ${avgScore.toFixed(3)} (threshold: ${threshold})`,
  );

  // Always use space docs — sort by score so most relevant chunks come first
  const sorted = scored.sort((a, b) => b.score - a.score);
  const confidence = Math.max(avgScore, 0.3); // floor at 0.3 since we have space content

  console.log(
    `[CRAG Corrector] Using ${sorted.length} space doc(s) with confidence ${confidence.toFixed(2)}`,
  );

  return {
    docs: sorted.map((s) => s.doc),
    confidence: Math.round(confidence * 100) / 100,
    usedWebSearch: false,
  };
}
