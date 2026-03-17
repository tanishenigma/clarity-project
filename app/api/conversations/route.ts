import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import ConversationModel from "@/lib/models/Conversation";
import ChatHistoryModel from "@/lib/models/ChatHistory";

// GET - List all conversations for a user in a space
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const spaceId = searchParams.get("spaceId");

    if (!userId || !spaceId) {
      return NextResponse.json(
        { error: "Missing userId or spaceId" },
        { status: 400 },
      );
    }

    await connectDB();

    // Get all conversations with their last message preview
    const conversations = await ConversationModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          spaceId: new Types.ObjectId(spaceId),
        },
      },
      {
        $lookup: {
          from: "chat_history",
          localField: "_id",
          foreignField: "conversationId",
          as: "history",
        },
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ["$history.messages", -1] },
          messageCount: {
            $size: {
              $ifNull: [{ $arrayElemAt: ["$history.messages", 0] }, []],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          active: 1,
          preview: {
            $cond: {
              if: { $gt: [{ $size: "$history" }, 0] },
              then: {
                $arrayElemAt: [{ $arrayElemAt: ["$history.messages", 0] }, 0],
              },
              else: null,
            },
          },
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);

    // Format conversations with preview
    const formattedConversations = conversations.map((conv) => ({
      _id: conv._id.toString(),
      title: conv.title || "New Conversation",
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      active: conv.active,
      preview: conv.preview?.content?.substring(0, 50) || "No messages yet",
    }));

    return NextResponse.json({ conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

// POST - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { userId, spaceId, title } = await request.json();

    if (!userId || !spaceId) {
      return NextResponse.json(
        { error: "Missing userId or spaceId" },
        { status: 400 },
      );
    }

    await connectDB();

    // Deactivate any existing active conversations
    await ConversationModel.updateMany(
      {
        userId,
        spaceId,
        active: true,
      },
      { $set: { active: false } },
    );

    // Create new conversation
    const conv = await ConversationModel.create({
      userId,
      spaceId,
      title: title || "New Conversation",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      conversationId: conv._id.toString(),
      message: "Conversation created",
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a conversation
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

    // Delete the conversation
    await ConversationModel.deleteOne({
      _id: conversationId,
    });

    // Delete associated chat history
    await ChatHistoryModel.deleteMany({
      conversationId,
    });

    return NextResponse.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
