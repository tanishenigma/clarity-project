import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import NoteModel from "@/lib/models/Note";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notes — list all notes for current user
export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notes = await NoteModel.find({ userId: user._id!.toString() })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      notes: notes.map((n) => ({
        ...n,
        _id: n._id.toString(),
      })),
    });
  } catch (error) {
    console.error("[Notes GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

// POST /api/notes — create a new note
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, content } = await request.json();

    const note = await NoteModel.create({
      userId: user._id!.toString(),
      title: title ?? "Untitled",
      content: content ?? "",
    });

    return NextResponse.json({
      note: { ...note.toObject(), _id: note._id.toString() },
    });
  } catch (error) {
    console.error("[Notes POST]", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 },
    );
  }
}
