import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import NoteModel from "@/lib/models/Note";
import { getCurrentUser } from "@/lib/auth";

// PUT /api/notes/[id] — update a note's title + content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { title, content } = await request.json();

    const note = await NoteModel.findOneAndUpdate(
      { _id: id, userId: user._id!.toString() },
      { title, content },
      { new: true },
    ).lean();

    if (!note)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ note: { ...note, _id: note._id.toString() } });
  } catch (error) {
    console.error("[Notes PUT]", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 },
    );
  }
}

// DELETE /api/notes/[id] — delete a note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await NoteModel.findOneAndDelete({ _id: id, userId: user._id!.toString() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notes DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 },
    );
  }
}
