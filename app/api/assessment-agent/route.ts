import { type NextRequest, NextResponse } from "next/server";
import {
  getAssessmentCatalog,
  runAssessmentAgent,
} from "@/lib/services/assessment-agent";

export const runtime = "nodejs";
export const maxDuration = 120;

function getStringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumberValue(
  value: FormDataEntryValue | null,
  fallback: number,
): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  try {
    const catalog = await getAssessmentCatalog();
    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AssessmentAgent] GET failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const uploadedPdf =
      file instanceof File
        ? {
            fileName: file.name,
            buffer: Buffer.from(await file.arrayBuffer()),
          }
        : undefined;

    const result = await runAssessmentAgent({
      userId: getStringValue(formData.get("userId")),
      courseCode: getStringValue(formData.get("courseCode")),
      courseName: getStringValue(formData.get("courseName")),
      examType: getStringValue(formData.get("examType")),
      semester: getStringValue(formData.get("semester")),
      topTopicCount: getNumberValue(formData.get("topTopicCount"), 8),
      predictedQuestionCount: getNumberValue(
        formData.get("predictedQuestionCount"),
        5,
      ),
      uploadedPdf,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AssessmentAgent] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
