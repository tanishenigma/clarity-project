import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";
import ContentModel from "@/lib/models/Content";
import SpaceModel from "@/lib/models/Space";
import QuizModel from "@/lib/models/Quiz";
import { parseAIJson } from "@/lib/utils/parse-ai-json";

// POST - Generate a quiz using AI from space content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, difficulty = "medium", numQuestions = 10 } = body;

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
        { error: "No content in this space to generate quiz from" },
        { status: 400 },
      );
    }

    // Combine text from all content
    const combinedText = contents
      .map((c) => c.processed?.rawText || c.title || "")
      .join("\n\n")
      .substring(0, 5000);

    // Get space info
    const space = await SpaceModel.findById(spaceId).lean();

    const userSettings = await getUserAPISettings(userId);
    const model = createAIClient(
      "gemini-2.5-flash-lite",
      0.7,
      userSettings,
      true,
    );

    const difficultyGuide =
      difficulty === "easy"
        ? "Simple recall questions covering basic concepts"
        : difficulty === "medium"
          ? "Application-based questions requiring concept understanding"
          : "Analysis and synthesis questions for deep expertise";

    const prompt = `Generate ${numQuestions} multiple choice quiz questions (${difficulty} difficulty) based on the following content.
${difficultyGuide}

For each question, provide a JSON object with:
- text: The question text
- options: Array of 4 options
- correctAnswer: The correct option (exact match from options)
- explanation: Brief explanation of why the answer is correct

MATH FORMATTING RULES (strictly follow these):
- Wrap ALL mathematical expressions, equations, variables, and symbols in LaTeX delimiters.
- Use $...$ for inline math (e.g. $x^2 + y^2 = z^2$, $\\alpha$, $D_{KL}(p\\|q)$).
- Use $$...$$ for standalone/display equations on their own line.
- Apply this to question text, every option, and the explanation — never write raw math without delimiters.

Content:
${combinedText}

Subject: ${space?.subject || "General"}

IMPORTANT: Return ONLY a valid JSON array, no markdown formatting, no code blocks. Example format:
[{"text": "What is $x$ if $2x = 8$?", "options": ["$x = 2$", "$x = 4$", "$x = 6$", "$x = 8$"], "correctAnswer": "$x = 4$", "explanation": "Dividing both sides by 2 gives $x = 4$."}]`;

    const response = await model.invoke([
      new SystemMessage(
        "You are a quiz generation assistant. You MUST respond with ONLY a valid JSON array — no markdown, no code fences, no explanation, no prose before or after. Output raw JSON only.",
      ),
      new HumanMessage(prompt),
    ]);
    const responseText = response.content.toString();

    // Parse the JSON response
    let questions;
    try {
      questions = parseAIJson<any[]>(responseText);
    } catch (parseError) {
      console.error("[Quiz] Failed to parse AI response:", responseText);
      return NextResponse.json(
        { error: "Failed to generate quiz — AI returned invalid JSON" },
        { status: 500 },
      );
    }

    // Create the quiz
    const quiz = await QuizModel.create({
      spaceId,
      userId,
      title: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz - ${space?.name || "Study Space"}`,
      difficulty,
      questions: questions.map((q: any, index: number) => {
        const correctIndex = Array.isArray(q.options)
          ? q.options.indexOf(q.correctAnswer)
          : -1;
        return {
          text: q.text,
          type: "mcq",
          options: q.options || [],
          correctAnswer: correctIndex !== -1 ? correctIndex : 0,
          explanation: q.explanation || "",
          tags: [],
          order: index,
        };
      }),
      attempts: [],
      generatedAt: new Date(),
      isActive: true,
    });

    return NextResponse.json({
      quiz: {
        ...quiz.toObject(),
        _id: quiz._id.toString(),
        spaceId: spaceId,
        userId: userId,
      },
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 },
    );
  }
}
