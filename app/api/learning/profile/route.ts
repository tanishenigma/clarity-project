/**
 * Student Profile API Route
 * GET /api/learning/profile?userId={id} - Get student profile
 * POST /api/learning/profile - Create/update student profile
 */

import { type NextRequest, NextResponse } from "next/server";
import { learningSpaceService } from "@/lib/services/learning-space-service";
import { connectDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 },
      );
    }

    const profile = await learningSpaceService.getStudentProfile(userId);

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch profile",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { userId, gender, gradeLevel, language } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await learningSpaceService.upsertStudentProfile(userId, {
      gender,
      gradeLevel,
      language,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating student profile:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      },
      { status: 500 },
    );
  }
}
