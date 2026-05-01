import { type NextRequest, NextResponse } from "next/server";
import { createYouTubeAgent, extractVideoId } from "@/lib/agents/youtube-agent";
import { getUserAPISettings } from "@/lib/ai-client";
import type { YouTubeAnalysisOptions } from "@/lib/agents/youtube-agent";

// POST /api/youtube/analyze
// Body: { url: string; userId?: string; options?: YouTubeAnalysisOptions }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      url,
      userId,
      options = {},
    } = body as {
      url: string;
      userId?: string;
      options?: YouTubeAnalysisOptions;
    };

    if (!url) {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 },
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Could not extract a valid YouTube video ID from the provided URL.",
        },
        { status: 400 },
      );
    }

    const userSettings = userId ? await getUserAPISettings(userId) : undefined;
    const agent = createYouTubeAgent(userSettings ?? undefined);

    const result = await agent.analyzeVideo(url, options);

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[YouTube Agent] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/youtube/analyze?url=<youtube_url>&userId=<id>
// Lightweight endpoint that returns only the transcript (no AI analysis)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing query parameter: url" },
        { status: 400 },
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Could not extract a valid YouTube video ID from the provided URL.",
        },
        { status: 400 },
      );
    }

    const { fetchTranscript } = createYouTubeAgent();
    const videoInfo = await fetchTranscript(url);

    return NextResponse.json({
      success: true,
      data: {
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        author: videoInfo.author,
        transcriptAvailable: videoInfo.transcriptAvailable,
        transcript: videoInfo.transcript,
        segments: videoInfo.segments,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[YouTube Transcript Fetch] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
