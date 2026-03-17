import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import GlobalConversationModel from "@/lib/models/GlobalConversation";

// GET - List all global conversations for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();

    const conversations = await GlobalConversationModel.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    const formattedConversations = conversations.map((conv) => {
      const messages: any[] = conv.messages || [];
      // Find the last assistant message for a meaningful preview
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m.role === "assistant");
      const preview = lastAssistant
        ? lastAssistant.content?.substring(0, 80) || "No messages yet"
        : messages.length > 0
          ? messages[0].content?.substring(0, 80) || "No messages yet"
          : "No messages yet";

      return {
        _id: conv._id.toString(),
        title: conv.title || "New Conversation",
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        preview,
      };
    });

    return NextResponse.json({ conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching global conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

// POST - Create a new global conversation
export async function POST(request: NextRequest) {
  try {
    const { userId, title } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();

    const conv = await GlobalConversationModel.create({
      userId,
      title: title || "New Conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      conversationId: conv._id.toString(),
      message: "Conversation created",
    });
  } catch (error) {
    console.error("Error creating global conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a global conversation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 },
      );
    }

    await connectDB();

    await GlobalConversationModel.deleteOne({
      _id: conversationId,
    });

    return NextResponse.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("Error deleting global conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
