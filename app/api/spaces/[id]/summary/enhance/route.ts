import { type NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";

const ENHANCE_PROMPTS: Record<string, string> = {
  explain:
    "Rewrite or expand the following text to explain it more clearly and in greater depth. " +
    "Use simple language. Return only valid HTML (use <p>, <ul>, <li>, <strong>, <em> as needed). " +
    "Do NOT wrap in a code block.",
  example:
    "Provide one or more concrete, real-world examples that illustrate the following concept. " +
    "Return only valid HTML (use <p>, <ul>, <li>, <strong> as needed). " +
    "Do NOT wrap in a code block.",
  reword:
    "Reword the following text to make it more concise and easier to memorise. " +
    "Keep all key information but use clearer, simpler language. " +
    "Return only valid HTML (use <p>, <ul>, <li>, <strong> as needed). " +
    "Do NOT wrap in a code block.",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, text, type } = body as {
      userId: string;
      text: string;
      type: "explain" | "example" | "reword";
    };

    if (!userId || !text || !type) {
      return NextResponse.json(
        { error: "Missing userId, text or type" },
        { status: 400 },
      );
    }

    const instruction = ENHANCE_PROMPTS[type];
    if (!instruction) {
      return NextResponse.json(
        { error: `Unknown enhance type: ${type}` },
        { status: 400 },
      );
    }

    const userSettings = await getUserAPISettings(userId);
    const model = createAIClient("gemini-2.5-flash-lite", 0.6, userSettings);

    const systemMsg = new SystemMessage(
      "You are a study-notes enhancement assistant. " +
        "Always respond with clean HTML only — no markdown, no code fences, no extra commentary.",
    );

    const userMsg = new HumanMessage(`${instruction}\n\n---\n${text}\n---`);

    const response = await model.invoke([systemMsg, userMsg]);
    let result = response.content.toString().trim();

    // Strip accidental markdown fences
    const fenceMatch = result.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (fenceMatch) result = fenceMatch[1].trim();

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[Summary Enhance] Error:", error);
    return NextResponse.json(
      { error: "Failed to enhance text" },
      { status: 500 },
    );
  }
}
