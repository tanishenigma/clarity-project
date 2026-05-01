import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import { UserModel } from "@/lib/models";

export interface ChatbotPersonalization {
  tutorName: string;
  tone: "friendly" | "formal" | "socratic" | "motivating";
  teachingStyle: "concise" | "detailed" | "step-by-step" | "examples";
  customInstructions: string;
}

export async function getChatbotPersonalization(
  userId: string,
): Promise<ChatbotPersonalization | null> {
  try {
    await connectDB();
    const user = await UserModel.findById(new Types.ObjectId(userId), {
      chatbotPersonalization: 1,
    }).lean();
    return (user as any)?.chatbotPersonalization ?? null;
  } catch {
    return null;
  }
}

export function buildPersonalizationPrompt(
  p: ChatbotPersonalization | null,
): string {
  if (!p) return "";

  const toneMap = {
    friendly: "warm, approachable, and encouraging",
    formal: "professional, precise, and formal",
    socratic:
      "Socratic — guide the student to answers through questions rather than stating facts directly",
    motivating: "highly motivating, enthusiastic, and uplifting",
  };

  const styleMap = {
    concise:
      "Keep answers concise and to the point. Avoid unnecessary elaboration.",
    detailed:
      "Provide thorough, well-structured explanations covering all relevant details.",
    "step-by-step":
      "Always break down explanations into clear, numbered steps.",
    examples:
      "Lead with concrete real-world examples before explaining abstract concepts.",
  };

  const lines: string[] = [
    `Your name is ${p.tutorName || "Nova"}.`,
    `Your tone should be ${toneMap[p.tone] ?? toneMap.friendly}.`,
    styleMap[p.teachingStyle] ?? styleMap.detailed,
  ];

  if (p.customInstructions?.trim()) {
    lines.push(
      `Additional instructions from the student: ${p.customInstructions.trim()}`,
    );
  }

  return `\nTUTOR PERSONA:\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
}
