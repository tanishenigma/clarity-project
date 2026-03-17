import { Innertube } from "youtubei.js";
import { AIClient } from "../ai-client";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { APISettings } from "../types";
import { parseAIJson } from "../utils/parse-ai-json";

export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  author: string;
  viewCount: string;
  transcript: string;
  segments: TranscriptSegment[];
  transcriptAvailable: boolean;
}

export interface YouTubeAnalysisResult {
  videoId: string;
  title?: string;
  transcript: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  suggestedQuestions: string[];
}

export interface YouTubeAnalysisOptions {
  generateSummary?: boolean;
  generateKeyPoints?: boolean;
  generateTopics?: boolean;
  generateQuestions?: boolean;
  summaryLength?: "brief" | "detailed";
  lang?: string;
}

/**
 * Extracts the YouTube video ID from a URL or returns the raw ID if already one.
 */
export function extractVideoId(input: string): string | null {
  // Already a bare video ID (11 chars, alphanumeric + _ -)
  if (/^[\w-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    // Standard: https://www.youtube.com/watch?v=VIDEO_ID
    const v = url.searchParams.get("v");
    if (v) return v;

    // Short: https://youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }

    // Embed: https://www.youtube.com/embed/VIDEO_ID
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/embed/")[1]?.split("/")[0] || null;
    }

    // Shorts: https://www.youtube.com/shorts/VIDEO_ID
    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/shorts/")[1]?.split("/")[0] || null;
    }
  } catch {
    // Not a valid URL, not a bare ID either
  }

  return null;
}

/**
 * Fetches YouTube video metadata and attempts to retrieve the transcript.
 * Uses youtubei.js (InnerTube API) for reliable metadata access.
 * Transcript fetch may be blocked on datacenter IPs — falls back gracefully.
 */
export async function fetchYouTubeTranscript(
  videoIdOrUrl: string,
  lang = "en",
): Promise<YouTubeVideoInfo> {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    throw new Error(`Could not extract a valid video ID from: ${videoIdOrUrl}`);
  }

  const yt = await Innertube.create({ retrieve_player: true });
  const info = await yt.getInfo(videoId);

  const title = info.basic_info?.title ?? "Unknown Title";
  const description = info.basic_info?.short_description ?? "";
  const author = info.basic_info?.author ?? "Unknown";
  const viewCount = String(info.basic_info?.view_count ?? "");

  // --- Attempt transcript via InnerTube caption track URL ---
  let transcript = "";
  let segments: TranscriptSegment[] = [];
  let transcriptAvailable = false;

  const captionTracks = info.captions?.caption_tracks ?? [];
  const track =
    captionTracks.find((t: any) => t.language_code === lang) ??
    captionTracks.find((t: any) => t.language_code?.startsWith("en")) ??
    captionTracks[0];

  if (track?.base_url) {
    try {
      // Try json3 format via youtubei session client (preserves session cookies)
      const xmlRes = await yt.session.http.fetch(
        new URL(track.base_url + "&fmt=json3"),
      );
      const body = await xmlRes.text();

      if (body && body.trim().startsWith("{")) {
        // JSON3 format
        const json3 = JSON.parse(body);
        segments = ((json3.events ?? []) as any[])
          .filter((e: any) => e.segs)
          .map((e: any) => ({
            text: (e.segs as any[])
              .map((s: any) => s.utf8 ?? "")
              .join("")
              .replace(/\n/g, " ")
              .trim(),
            offset: (e.tStartMs ?? 0) / 1000,
            duration: (e.dDurationMs ?? 0) / 1000,
          }))
          .filter((s: TranscriptSegment) => s.text.length > 0);
        transcript = segments.map((s) => s.text).join(" ");
        transcriptAvailable = segments.length > 0;
      } else if (body && body.includes("<text")) {
        // XML format fallback
        const xmlRe =
          /<text start="([\d.]+)"[^>]*dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
        let m: RegExpExecArray | null;
        while ((m = xmlRe.exec(body)) !== null) {
          const raw = m[3]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]+>/g, "")
            .trim();
          if (raw) {
            segments.push({
              text: raw,
              offset: parseFloat(m[1]),
              duration: parseFloat(m[2]),
            });
          }
        }
        transcript = segments.map((s) => s.text).join(" ");
        transcriptAvailable = segments.length > 0;
      }
    } catch (err) {
      console.warn(
        `[YouTubeAgent] Transcript fetch failed for ${videoId}:`,
        err,
      );
    }
  }

  return {
    videoId,
    title,
    description,
    author,
    viewCount,
    transcript,
    segments,
    transcriptAvailable,
  };
}

/**
 * Functional factory for the YouTube Analysis Agent.
 */
export function createYouTubeAgent(userSettings?: APISettings) {
  const model = new AIClient(
    process.env.AI_MODEL || "gemini-2.5-flash-lite",
    0.6,
    userSettings,
  );

  // -------- private helpers --------

  async function generateSummary(
    transcript: string,
    length: "brief" | "detailed" = "detailed",
  ): Promise<string> {
    const lengthHint =
      length === "brief"
        ? "Write a concise 2-3 sentence summary."
        : "Write a comprehensive summary in 4-6 paragraphs covering the main ideas, arguments, and conclusions.";

    const messages = [
      new SystemMessage(
        "You are an expert educational content analyser. Your task is to summarise YouTube video transcripts accurately and helpfully.",
      ),
      new HumanMessage(
        `Below is the full transcript of a YouTube video. ${lengthHint}\n\nTranscript:\n${transcript}`,
      ),
    ];

    const response = await model.invoke(messages);
    return typeof response.content === "string"
      ? response.content
      : String(response.content);
  }

  async function generateKeyPoints(transcript: string): Promise<string[]> {
    const messages = [
      new SystemMessage("You are an expert educational content analyser."),
      new HumanMessage(
        `Extract the 5-8 most important key points from the following YouTube transcript. Return them as a JSON array of strings — no markdown fences, just the array.\n\nTranscript:\n${transcript}`,
      ),
    ];

    const raw = await model.invoke(messages);
    const text =
      typeof raw.content === "string" ? raw.content : String(raw.content);

    try {
      const parsed = parseAIJson<unknown>(text);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // Fallback: split on newlines
      return text
        .split("\n")
        .map((l: string) => l.replace(/^[\d\-\*\.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 8);
    }
    return [];
  }

  async function generateTopics(transcript: string): Promise<string[]> {
    const messages = [
      new SystemMessage("You are an expert educational content classifier."),
      new HumanMessage(
        `Identify the main topics and subject areas covered in the following YouTube transcript. Return them as a JSON array of short topic strings — no markdown fences, just the array.\n\nTranscript:\n${transcript}`,
      ),
    ];

    const raw = await model.invoke(messages);
    const text =
      typeof raw.content === "string" ? raw.content : String(raw.content);

    try {
      const parsed = parseAIJson<unknown>(text);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      return text
        .split("\n")
        .map((l: string) => l.replace(/^[\d\-\*\.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    return [];
  }

  async function generateStudyQuestions(transcript: string): Promise<string[]> {
    const messages = [
      new SystemMessage("You are an expert educator creating study questions."),
      new HumanMessage(
        `Based on the following YouTube transcript, generate 5 thoughtful study/comprehension questions that would help a student test their understanding. Return them as a JSON array of question strings — no markdown fences, just the array.\n\nTranscript:\n${transcript}`,
      ),
    ];

    const raw = await model.invoke(messages);
    const text =
      typeof raw.content === "string" ? raw.content : String(raw.content);

    try {
      const parsed = parseAIJson<unknown>(text);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      return text
        .split("\n")
        .map((l: string) => l.replace(/^[\d\-\*\.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return [];
  }

  // -------- public API --------

  async function analyzeVideo(
    videoIdOrUrl: string,
    options: YouTubeAnalysisOptions = {},
  ): Promise<YouTubeAnalysisResult> {
    console.log("[YouTubeAgent] YouTube intent detected:", videoIdOrUrl);

    const {
      generateSummary: doSummary = true,
      generateKeyPoints: doKeyPoints = true,
      generateTopics: doTopics = true,
      generateQuestions: doQuestions = true,
      summaryLength = "detailed",
      lang = "en",
    } = options;

    // 1. Fetch video info (metadata + transcript attempt)
    const videoInfo = await fetchYouTubeTranscript(videoIdOrUrl, lang);

    // Use transcript if available, otherwise fall back to description
    const analysisText = videoInfo.transcriptAvailable
      ? videoInfo.transcript
      : videoInfo.description;

    if (!analysisText.trim()) {
      throw new Error(
        "Neither transcript nor description is available for this video.",
      );
    }

    // 2. Run analysis tasks in parallel
    const [summary, keyPoints, topics, suggestedQuestions] = await Promise.all([
      doSummary
        ? generateSummary(analysisText, summaryLength)
        : Promise.resolve(""),
      doKeyPoints ? generateKeyPoints(analysisText) : Promise.resolve([]),
      doTopics ? generateTopics(analysisText) : Promise.resolve([]),
      doQuestions ? generateStudyQuestions(analysisText) : Promise.resolve([]),
    ]);

    return {
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      transcript: videoInfo.transcript,
      summary,
      keyPoints,
      topics,
      suggestedQuestions,
    };
  }

  return { analyzeVideo, fetchTranscript: fetchYouTubeTranscript };
}
