import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import QuizModel from "@/lib/models/Quiz";
import SpaceModel from "@/lib/models/Space";

// GET - Fetch a single quiz
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();
    const quiz = await QuizModel.findById(id).lean();

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get space name if available
    let spaceName = "";
    if (quiz.spaceId) {
      const space = await SpaceModel.findById(quiz.spaceId).lean();
      if (space) {
        spaceName = space.name;
      }
    }

    return NextResponse.json({
      ...quiz,
      _id: quiz._id.toString(),
      spaceId: quiz.spaceId?.toString() || "",
      spaceName,
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();
    await QuizModel.deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 },
    );
  }
}

// PATCH - Mark quiz as completed (or update score on reattempt)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { score } = await request.json();
    await connectDB();

    await QuizModel.updateOne(
      { _id: id },
      {
        $set: {
          completedAt: new Date(),
          lastScore: score,
        },
        $inc: { attemptCount: 1 },
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 },
    );
  }
}
