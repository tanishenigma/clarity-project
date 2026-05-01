/**
 * CRAG Retriever
 *
 * Fetches candidate documents exclusively from content items uploaded by the
 * user to the given learning space (MongoDB ContentModel).
 *
 * Strategy (in priority order):
 *  1. Use pre-computed chunks from `processed.chunks` (fastest)
 *  2. Fall back to `processed.rawText / transcript / ocr` and re-chunk
 *  3. If content is still pending/unprocessed, extract text live from the
 *     Cloudinary URL (PDF → pdf-parse, image → Tesseract OCR)
 *
 * Ranks all candidate chunks by TF-IDF cosine similarity — no external
 * embedding service required.
 */

import { connectDB } from "@/lib/db";
import { ContentModel } from "@/lib/models";
import { Types } from "mongoose";

const TOP_K = 5;
const CHUNK_SIZE = 500; // characters

// ── TF-IDF helpers ────────────────────────────────────────────────────────────

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

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
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

function splitIntoChunks(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 20) chunks.push(chunk);
  }
  return chunks;
}

// ── Live extraction from UploadThing URL ───────────────────────────────────────

async function extractTextFromUrl(
  url: string,
  mimeType: string,
): Promise<string> {
  if (!url) return "";

  try {
    if (mimeType === "application/pdf" || url.endsWith(".pdf")) {
      const fetchUrl = url;
      console.log(`[CRAG Retriever] Live PDF extraction: ${fetchUrl}`);
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        console.error(
          `[CRAG Retriever] PDF fetch failed: ${res.status} ${res.statusText}`,
        );
        return "";
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const { extractPdfText } = await import("@/lib/utils/pdf-extract");
      const text = await extractPdfText(buffer);
      console.log(`[CRAG Retriever] PDF extracted ${text.length} chars`);
      return text;
    }

    if (mimeType.startsWith("image/")) {
      const fetchUrl = url;
      console.log(`[CRAG Retriever] Live OCR extraction: ${fetchUrl}`);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = require("tesseract.js");
      const { data } = await Tesseract.recognize(fetchUrl, "eng", {
        logger: () => {},
      });
      console.log(`[CRAG Retriever] OCR extracted ${data.text.length} chars`);
      return data.text ?? "";
    }

    // For other types (audio, video, links) we can't extract live — skip
    return "";
  } catch (err) {
    console.error("[CRAG Retriever] Live extraction failed:", err);
    return "";
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface RetrievedDoc {
  text: string;
  source: "space" | "web";
  score: number;
  title?: string;
}

// ── Main retriever ────────────────────────────────────────────────────────────

/**
 * Retrieve the top-K most relevant chunks from the user's uploaded space
 * content for the given query.
 */
export async function retrieve(
  query: string,
  spaceId: string,
  userId: string,
  k = TOP_K,
): Promise<RetrievedDoc[]> {
  if (!spaceId || spaceId.length !== 24 || !userId || userId.length !== 24) {
    return [];
  }

  try {
    await connectDB();

    // Fetch all content for this space — include both completed and pending
    // so we can do live extraction for pending ones
    const items = await ContentModel.find({
      spaceId: new Types.ObjectId(spaceId),
      userId: new Types.ObjectId(userId),
    })
      .select("title type processingStatus source processed")
      .lean();

    console.log(
      `[CRAG Retriever] Found ${items.length} content item(s) in space ${spaceId}`,
    );
    for (const item of items as any[]) {
      console.log(
        `[CRAG Retriever]   → "${item.title}" type=${item.type} status=${item.processingStatus} chunks=${item.processed?.chunks?.length ?? 0} rawText=${item.processed?.rawText?.length ?? 0}chars url=${item.source?.url ? "yes" : "no"}`,
      );
    }

    if (items.length === 0) return [];

    const queryVec = buildTfVector(tokenize(query));

    // Build chunks from each content item
    const allChunks: Array<{ text: string; title: string }> = [];

    for (const item of items as any[]) {
      let chunks: string[] = [];

      // Priority 1: pre-computed chunks with actual text
      if (item.processed?.chunks?.length > 0) {
        const fromChunks = item.processed.chunks
          .map((c: any) => c.text as string)
          .filter((t: string) => t?.trim().length > 20);
        if (fromChunks.length > 0) {
          chunks = fromChunks;
          console.log(
            `[CRAG Retriever] "${item.title}": using ${chunks.length} pre-computed chunks`,
          );
        }
      }

      // Priority 2: full processed text fields (rawText / transcript / ocr)
      if (chunks.length === 0) {
        const fullText: string =
          item.processed?.rawText ||
          item.processed?.transcript ||
          item.processed?.ocr ||
          "";
        if (fullText.trim()) {
          chunks = splitIntoChunks(fullText);
          console.log(
            `[CRAG Retriever] "${item.title}": split rawText into ${chunks.length} chunks`,
          );
        }
      }

      // Priority 3: live extraction from Cloudinary URL (for any status)
      if (chunks.length === 0) {
        const url: string = item.source?.url ?? "";
        const mimeType: string = item.source?.mimeType ?? "";
        if (url) {
          console.log(
            `[CRAG Retriever] "${item.title}": no processed text, attempting live extraction (${mimeType})`,
          );
          const liveText = await extractTextFromUrl(url, mimeType);
          if (liveText.trim()) {
            chunks = splitIntoChunks(liveText);
            console.log(
              `[CRAG Retriever] "${item.title}": live extraction yielded ${chunks.length} chunks`,
            );
          } else {
            console.warn(
              `[CRAG Retriever] "${item.title}": live extraction returned empty text`,
            );
          }
        } else {
          console.warn(
            `[CRAG Retriever] "${item.title}": no URL and no processed text — skipping`,
          );
        }
      }

      for (const chunk of chunks) {
        allChunks.push({ text: chunk, title: item.title ?? "Untitled" });
      }
    }

    console.log(`[CRAG Retriever] Total chunks to rank: ${allChunks.length}`);

    if (allChunks.length === 0) return [];

    const scored: RetrievedDoc[] = allChunks.map(({ text, title }) => ({
      text,
      source: "space" as const,
      score: cosineSimilarity(queryVec, buildTfVector(tokenize(text))),
      title,
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  } catch (err) {
    console.error("[CRAG Retriever] Error:", err);
    return [];
  }
}
