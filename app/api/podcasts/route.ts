import { type NextRequest, NextResponse } from "next/server";
import { PodcastGenerationAgent } from "@/lib/agents/podcast-agent";
import { connectDB } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { contentId, spaceId, style, type } = await request.json();

    if (!contentId || !spaceId) {
      return NextResponse.json(
        { error: "Missing contentId or spaceId" },
        { status: 400 },
      );
    }

    const agent = new PodcastGenerationAgent();

    let script: string;
    if (type === "conversational") {
      script = await agent.generateConversationalPodcast(contentId, spaceId);
    } else {
      script = await agent.generatePodcastScript(
        contentId,
        spaceId,
        style || "conversational",
      );
    }

    return NextResponse.json({
      success: true,
      script,
      contentId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const contentId = request.nextUrl.searchParams.get("contentId");

    if (!contentId) {
      return NextResponse.json({ error: "Missing contentId" }, { status: 400 });
    }

    const agent = new PodcastGenerationAgent();
    const podcast = await agent.getPodcast(contentId);

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }

    return NextResponse.json(podcast);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
