import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SummaryModel from "@/lib/models/Summary";

export async function GET(request: NextRequest) {
  try {
    const contentId = request.nextUrl.searchParams.get("contentId");
    const spaceId = request.nextUrl.searchParams.get("spaceId");

    if (!contentId && !spaceId) {
      return NextResponse.json(
        { error: "Missing contentId or spaceId" },
        { status: 400 },
      );
    }

    await connectDB();

    const query = contentId ? { contentId } : { spaceId: spaceId || "" };

    const summaries = await SummaryModel.find(query).lean();

    return NextResponse.json({
      summaries: summaries.map((s) => ({
        _id: s._id,
        type: s.type,
        title: s.title,
        generatedAt: s.generatedAt,
      })),
      totalCount: summaries.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { summaryId } = await request.json();

    await connectDB();
    const summary = await SummaryModel.findById(summaryId).lean();

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
