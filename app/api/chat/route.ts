import { type NextRequest, NextResponse } from "next/server";
import { createAITutorAgent } from "@/lib/agents/tutor-agent";
import { getUserAPISettings } from "@/lib/ai-client";
import { getChatbotPersonalization } from "@/lib/services/chatbot-personalization";
import { connectDB } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { userQuery, spaceId, userId, conversationId, images } =
      await request.json();

    console.log("Chat API called:", { userQuery, spaceId, userId });

    if (!userQuery || !spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const [userSettings, personalization] = await Promise.all([
      getUserAPISettings(userId),
      getChatbotPersonalization(userId),
    ]);
    // Initialize using the functional factory instead of a class
    const agent = createAITutorAgent(userSettings, personalization);

    // Get conversation history
    let convId = conversationId;
    if (!convId) {
      convId = await agent.getOrCreateConversation(userId, spaceId);
    }

    const history = await agent.getConversationHistory(convId);

    // Handle chat request
    const context = {
      spaceId,
      userId,
      conversationId: convId,
      activeContentIds: [],
      conversationHistory: history,
    };

    console.log("Calling handleTutorQuery...");
    const { response, toolsUsed, graphUpdate, feedbackLog } =
      await agent.handleTutorQuery(userQuery, context, images);

    console.log("API Response:", {
      hasResponse: !!response,
      hasGraphUpdate: !!graphUpdate,
      hasFeedbackLog: !!feedbackLog,
      toolsUsed,
      graphExpressions: graphUpdate?.expressions?.length || 0,
    });

    return NextResponse.json({
      response,
      conversationId: convId,
      toolsUsed,
      graphUpdate,
      feedbackLog,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 },
    );
  }
}
