import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContentModel from "@/lib/models/Content";
import SummaryModel from "@/lib/models/Summary";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();

    const content = await ContentModel.findById(id).lean();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Get related learning outputs
    const [summaries, flashcards, quizzes] = await Promise.all([
      SummaryModel.countDocuments({ contentId: id }),
      FlashcardModel.countDocuments({ contentId: id }),
      QuizModel.countDocuments({ contentId: id }),
    ]);

    return NextResponse.json({
      content: {
        _id: content._id,
        title: content.title,
        type: content.type,
        processingStatus: content.processingStatus,
        processingError: content.processingError,
      },
      outputs: {
        summaries,
        flashcards,
        quizzes,
      },
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 },
    );
  }
}
