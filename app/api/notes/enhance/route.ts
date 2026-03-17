import { type NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";

/**
 * POST /api/notes/enhance
 *
 * Used by the floating selection menu for inline text editing in notes
 * and summary views.
 *
 * Body:
 *   { text: string; mode: "enhance" | "edit"; instruction?: string; userId?: string }
 *
 * Returns:
 *   { enhanced: string }  — plain text replacement for the selected range
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, mode, instruction, userId } = body as {
      text: string;
      mode: "enhance" | "edit";
      instruction?: string;
      userId?: string;
    };

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const userSettings = userId ? await getUserAPISettings(userId) : undefined;
    const model = createAIClient("gemini-2.5-flash-lite", 0.5, userSettings);

    const systemMsg = new SystemMessage(
      "You are a study-notes editing assistant. " +
        "Return ONLY the rewritten text — no explanations, no markdown, no code fences. " +
        "Keep the response concise and on-topic.",
    );

    let prompt: string;
    if (mode === "edit" && instruction) {
      prompt =
        `Apply the following instruction to the given text and return the improved version:\n\n` +
        `Instruction: ${instruction}\n\n` +
        `Text: ${text}`;
    } else {
      prompt =
        `Improve the following study-notes excerpt to be clearer and more concise, ` +
        `preserving all key information:\n\n${text}`;
    }

    const response = await model.invoke([systemMsg, new HumanMessage(prompt)]);

    const enhanced = response.content.toString().trim();
    return NextResponse.json({ enhanced });
  } catch (error) {
    console.error("[Notes Enhance] Error:", error);
    return NextResponse.json(
      { error: "Enhancement failed — please try again" },
      { status: 500 },
    );
  }
}
