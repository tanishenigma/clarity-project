import { type NextRequest, NextResponse } from "next/server";
import { SpaceCollaborationManager } from "@/lib/services/space-collaboration";
import { connectDB } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const { userEmail, role, userId } = await request.json();

    if (!userEmail || !role || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const manager = new SpaceCollaborationManager();
    const invite = await manager.shareSpace(id, userEmail, role, userId);

    return NextResponse.json({
      success: true,
      invite,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const manager = new SpaceCollaborationManager();
    const collaborators = await manager.getCollaborators(id);

    return NextResponse.json({
      collaborators,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
