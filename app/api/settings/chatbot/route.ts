import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import UserModel from "@/lib/models/User";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    console.log(
      "[Settings/Chatbot GET] Fetching chatbot personalization for userId:",
      userId,
    );

    await connectDB();
    const user = await UserModel.findById(userId)
      .select("chatbotPersonalization")
      .lean();

    return NextResponse.json({
      personalization: user?.chatbotPersonalization ?? null,
    });
  } catch (error) {
    console.error("Error fetching chatbot personalization:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, personalization } = body;

    if (!userId || !personalization) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    console.log(
      "[Settings/Chatbot PUT] Saving chatbot personalization for userId:",
      userId,
    );

    await connectDB();
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          chatbotPersonalization: {
            ...personalization,
            updatedAt: new Date(),
          },
        },
      },
    );

    console.log(
      "[Settings/Chatbot PUT] Chatbot personalization saved successfully for userId:",
      userId,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving chatbot personalization:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
