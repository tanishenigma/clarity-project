import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SpaceModel from "@/lib/models/Space";
import ContentModel from "@/lib/models/Content";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";
import StudySessionModel from "@/lib/models/StudySession";
import SummaryModel from "@/lib/models/Summary";
import ChatHistoryModel from "@/lib/models/ChatHistory";

// GET - Fetch a single space with all its data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    console.log("[Spaces GET] Fetching space with id:", id);

    const space = await SpaceModel.findById(id).lean();
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const [content, flashcards, quizzes, studySessions] = await Promise.all([
      ContentModel.find({ spaceId: id }).lean(),
      FlashcardModel.find({ spaceId: id }).lean(),
      QuizModel.find({ spaceId: id }).lean(),
      StudySessionModel.find({ spaceId: id }).lean(),
    ]);

    const totalStudyMinutes = studySessions.reduce(
      (acc, s) => acc + (s.durationMinutes || 0),
      0,
    );

    return NextResponse.json({
      space: {
        ...space,
        _id: space._id.toString(),
        userId: space.userId.toString(),
      },
      content: content.map((c) => ({ ...c, _id: c._id.toString() })),
      flashcards: flashcards.map((f) => ({ ...f, _id: f._id.toString() })),
      quizzes: quizzes.map((q) => ({ ...q, _id: q._id.toString() })),
      stats: {
        contentCount: content.length,
        flashcardCount: flashcards.length,
        quizCount: quizzes.length,
        totalStudyMinutes,
      },
    });
  } catch (error) {
    console.error("Error fetching space:", error);
    return NextResponse.json(
      { error: "Failed to fetch space" },
      { status: 500 },
    );
  }
}

// PUT - Update a space
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { name, description, icon, subject, examTarget, isPublic } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (subject !== undefined) updateData.subject = subject;
    if (examTarget !== undefined) updateData.examTarget = examTarget;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    await SpaceModel.findByIdAndUpdate(id, { $set: updateData });

    console.log(
      "[Spaces PUT] Space updated - id:",
      id,
      "fields:",
      Object.keys(updateData).join(", "),
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating space:", error);
    return NextResponse.json(
      { error: "Failed to update space" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a space and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;

    console.log("[Spaces DELETE] Deleting space and related data for id:", id);

    await Promise.all([
      SpaceModel.deleteOne({ _id: id }),
      ContentModel.deleteMany({ spaceId: id }),
      FlashcardModel.deleteMany({ spaceId: id }),
      QuizModel.deleteMany({ spaceId: id }),
      SummaryModel.deleteMany({ spaceId: id }),
      ChatHistoryModel.deleteMany({ spaceId: id }),
    ]);

    console.log("[Spaces DELETE] Space deleted successfully for id:", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting space:", error);
    return NextResponse.json(
      { error: "Failed to delete space" },
      { status: 500 },
    );
  }
}
