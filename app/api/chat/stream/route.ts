import type { NextRequest } from "next/server";
import { createAITutorAgent } from "@/lib/agents/tutor-agent";
import { connectDB } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { userQuery, spaceId, userId, conversationId, images } =
      await request.json();

    // Validate required fields
    if (!userQuery) {
      return new Response(JSON.stringify({ error: "Missing userQuery" }), {
        status: 400,
      });
    }

    if (!spaceId) {
      return new Response(JSON.stringify({ error: "Missing spaceId" }), {
        status: 400,
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      });
    }

    // Validate ID formats (MongoDB ObjectId should be 24-char hex)
    const isValidObjectId = (id: string) =>
      id && id.length === 24 && /^[0-9a-f]{24}$/i.test(id);

    if (!isValidObjectId(spaceId)) {
      return new Response(JSON.stringify({ error: "Invalid spaceId format" }), {
        status: 400,
      });
    }

    if (!isValidObjectId(userId)) {
      return new Response(JSON.stringify({ error: "Invalid userId format" }), {
        status: 400,
      });
    }

    // Initialize using the functional factory instead of a class
    const agent = createAITutorAgent();

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await agent.getOrCreateConversation(userId, spaceId);
    }

    // Validate conversation ID if provided
    if (convId && !isValidObjectId(convId)) {
      console.error("Invalid conversationId format:", convId);
      return new Response(
        JSON.stringify({ error: "Invalid conversationId format" }),
        { status: 400 },
      );
    }

    const history = await agent.getConversationHistory(convId);

    // Create context
    const context = {
      spaceId,
      userId,
      conversationId: convId,
      activeContentIds: [],
      conversationHistory: history,
    };

    // Stream response
    const stream = await agent.streamTutorResponse(userQuery, context, images);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Stream failed",
      }),
      { status: 500 },
    );
  }
}
