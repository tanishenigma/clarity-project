import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import GlobalConversationModel from "@/lib/models/GlobalConversation";

// GET - Get full global conversation history
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

    const conversation =
      await GlobalConversationModel.findById(conversationId).lean();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      conversation: {
        _id: conversation._id.toString(),
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: conversation.messages || [],
    });
  } catch (error) {
    console.error("Error fetching global conversation:", error);
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

    await GlobalConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        title,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: "Conversation updated" });
  } catch (error) {
    console.error("Error updating global conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 },
    );
  }
}
