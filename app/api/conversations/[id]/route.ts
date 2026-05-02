import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import ConversationModel from "@/lib/models/Conversation";
import ChatHistoryModel from "@/lib/models/ChatHistory";

// GET - Get full conversation history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: conversationId } = await params;

    if (!conversationId || conversationId.length !== 24) {
      return NextResponse.json(
        { error: "Invalid conversationId" },
        { status: 400 },
      );
    }

    await connectDB();

    // Get conversation details
    const conversation =
      await ConversationModel.findById(conversationId).lean();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Get chat history — cast to ObjectId explicitly so Mongoose query matches
    const chatHistory = await ChatHistoryModel.findOne({
      conversationId: new Types.ObjectId(conversationId),
    }).lean();

    // Explicitly serialize messages so all fields (including citations) survive
    // the JSON serialization step correctly (no ObjectId/Date surprises).
    const messages = (chatHistory?.messages ?? []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : null,
      toolsUsed: msg.toolsUsed ?? undefined,
      graphUpdate: msg.graphUpdate ?? undefined,
      feedbackLog: msg.feedbackLog ?? undefined,
      citations: Array.isArray(msg.citations)
        ? msg.citations.map((c: any) => ({
            idx: c.idx,
            title: c.title,
            url: c.url,
            snippet: c.snippet,
            contentId: c.contentId,
          }))
        : [],
    }));

    return NextResponse.json({
      conversation: {
        _id: conversation._id.toString(),
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

// PATCH - Update conversation title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: conversationId } = await params;
    const { title } = await request.json();

    if (!conversationId || conversationId.length !== 24) {
      return NextResponse.json(
        { error: "Invalid conversationId" },
        { status: 400 },
      );
    }

    await connectDB();

    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        title,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: "Conversation updated" });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 },
    );
  }
}
