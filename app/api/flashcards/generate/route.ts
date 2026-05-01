import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";
import ContentModel from "@/lib/models/Content";
import FlashcardModel from "@/lib/models/Flashcard";
import { parseAIJson } from "@/lib/utils/parse-ai-json";

// POST - Generate flashcards using AI from space content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, numCards = 10, difficulty = "medium" } = body;

    if (!spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectDB();

    // Get space content
    const contents = await ContentModel.find({ spaceId }).lean();

    if (contents.length === 0) {
      return NextResponse.json(
        { error: "No content in this space to generate flashcards from" },
        { status: 400 },
      );
    }

    // Combine text from all content pieces
    const combinedText = contents
      .map((c) => c.processed?.rawText || c.title || "")
      .join("\n\n")
      .substring(0, 5000);

    const userSettings = await getUserAPISettings(userId);
    const model = createAIClient(
      "gemini-2.5-flash-lite",
      0.7,
      userSettings,
      true,
    );

    const difficultyGuide =
      difficulty === "easy"
        ? "Focus on definitions and basic facts"
        : difficulty === "medium"
          ? "Include concept explanations and relationships between ideas"
          : "Cover complex analysis, edge cases, and deeper synthesis";

    const prompt = `Generate ${numCards} flashcards (${difficulty} difficulty) based on the following content.
${difficultyGuide}

For each flashcard, provide a JSON object with:
- question: A clear, specific question about the concept itself (do NOT reference chapter names, chapter numbers, section titles, or document structure)
- answer: A concise but complete answer (2-4 sentences max) focused purely on the concept
- tags: Array of 1-3 relevant topic tags (lowercase)

Do NOT include phrases like "In Chapter 3...", "According to section 2...", "As mentioned in the introduction...", or any other references to document structure. Questions and answers must stand alone as self-contained knowledge.

MATH FORMATTING RULES (strictly follow these):
- Wrap ALL mathematical expressions, equations, variables, and symbols in LaTeX delimiters.
- Use $...$ for inline math (e.g. $E = mc^2$, $\\alpha$, $\\sum_{i=1}^n x_i$).
- Use $$...$$ for standalone/display equations on their own line.
- Apply this to both the question and the answer — never write raw math without delimiters.

Content:
${combinedText}

IMPORTANT: Return ONLY a valid JSON array, no markdown formatting, no code blocks. Example format:
[{"question": "What is $x$ if $2x = 8$?", "answer": "Dividing both sides by 2 gives $x = 4$.", "tags": ["algebra"]}]`;

    const response = await model.invoke([
      new SystemMessage(
        "You are a flashcard generation assistant. You MUST respond with ONLY a valid JSON array — no markdown, no code fences, no explanation, no prose before or after. Output raw JSON only.",
      ),
      new HumanMessage(prompt),
    ]);
    const responseText = response.content.toString();

    // Parse the JSON response
    let cards;
    try {
      cards = parseAIJson<any[]>(responseText);
    } catch (parseError) {
      console.error("[Flashcards] Failed to parse AI response:", responseText);
      return NextResponse.json(
        { error: "Failed to generate flashcards — AI returned invalid JSON" },
        { status: 500 },
      );
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: "No flashcards were generated" },
        { status: 500 },
      );
    }

    // Build flashcard documents
    const flashcardDocs = cards.map((card: any) => ({
      spaceId,
      userId,
      contentId: null,
      type: "normal",
      question: card.question || "",
      answer: card.answer || "",
      tags: Array.isArray(card.tags) ? card.tags : [],
      difficulty: 3,
      generatedAt: new Date(),
      reviewStats: {
        totalReviews: 0,
        correctCount: 0,
        lastReviewedAt: null,
        nextReviewAt: new Date(),
      },
    }));

    const inserted = await FlashcardModel.insertMany(flashcardDocs);

    return NextResponse.json({
      inserted: inserted.length,
      ids: inserted.map((c) => c._id.toString()),
    });
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcards" },
      { status: 500 },
    );
  }
}
