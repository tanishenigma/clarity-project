import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SpaceModel from "@/lib/models/Space";
import ContentModel from "@/lib/models/Content";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";

// GET - Fetch all spaces for a user
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    console.log("[Spaces GET] Fetching spaces for userId:", userId || "(all)");

    const query: any = userId
      ? { $or: [{ userId }, { collaborators: userId }] }
      : {};

    const spaces = await SpaceModel.find(query).sort({ updatedAt: -1 }).lean();

    const spacesWithStats = await Promise.all(
      spaces.map(async (space) => {
        const [contentCount, flashcardCount, quizCount] = await Promise.all([
          ContentModel.countDocuments({ spaceId: space._id }),
          FlashcardModel.countDocuments({ spaceId: space._id }),
          QuizModel.countDocuments({ spaceId: space._id }),
        ]);
        return {
          ...space,
          _id: space._id.toString(),
          userId: space.userId.toString(),
          stats: { contentCount, flashcardCount, quizCount },
        };
      }),
    );

    return NextResponse.json({ spaces: spacesWithStats });
  } catch (error) {
    console.error("Error fetching spaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch spaces" },
      { status: 500 },
    );
  }
}

// POST - Create a new space
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { userId, name, description, icon, subject, examTarget, isPublic } =
      body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(
      "[Spaces POST] Creating new space - userId:",
      userId,
      "name:",
      name,
    );

    const space = await SpaceModel.create({
      userId,
      name,
      description: description || "",
      subject: subject || "General",
      examTarget: examTarget || "",
      isPublic: isPublic || false,
      collaborators: [],
    });

    console.log(
      "[Spaces POST] Space created - id:",
      space._id.toString(),
      "name:",
      name,
    );

    return NextResponse.json({
      space: { ...space.toObject(), _id: space._id.toString(), userId },
    });
  } catch (error) {
    console.error("Error creating space:", error);
    return NextResponse.json(
      { error: "Failed to create space" },
      { status: 500 },
    );
  }
}
