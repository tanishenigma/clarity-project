import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createAIClient, getUserAPISettings } from "@/lib/ai-client";
import { connectDB } from "@/lib/db";
import ContentModel from "@/lib/models/Content";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";
import SpaceModel from "@/lib/models/Space";
import { parseAIJson } from "@/lib/utils/parse-ai-json";

export type StudyDifficulty = "easy" | "medium" | "hard";

interface LocalOllamaOptions {
  temperature?: number;
  numPredict?: number;
  timeoutMs?: number;
}

interface FlashcardDraft {
  question: string;
  answer: string;
  tags?: string[];
}

interface QuizDraft {
  text: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

function buildCombinedText(contents: any[], maxChars = 5000) {
  return contents
    .map(
      (content) =>
        content.processed?.rawText ||
        content.processed?.transcript ||
        content.processed?.ocr ||
        content.title ||
        "",
    )
    .join("\n\n")
    .substring(0, maxChars);
}

async function invokeFlashcardsWithProvider(
  combinedText: string,
  userId: string,
  numCards: number,
  difficulty: StudyDifficulty,
): Promise<FlashcardDraft[]> {
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
- Use $...$ for inline math.
- Use $$...$$ for standalone/display equations.
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

  const cards = parseAIJson<FlashcardDraft[]>(response.content.toString());
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("AI returned empty flashcard array");
  }

  return cards;
}

export async function invokeLocalOllama(
  prompt: string,
  {
    temperature = 0.2,
    numPredict = 2048,
    timeoutMs = 120_000,
  }: LocalOllamaOptions = {},
): Promise<string> {
  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature,
        num_predict: numPredict,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Local Ollama error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { response?: string };
  return data.response?.trim() ?? "";
}

async function invokeFlashcardsLocally(
  combinedText: string,
  numCards: number,
  difficulty: StudyDifficulty,
): Promise<FlashcardDraft[]> {
  const difficultyGuide =
    difficulty === "easy"
      ? "Keep the cards focused on definitions and direct recall."
      : difficulty === "medium"
        ? "Mix recall with short conceptual explanation questions."
        : "Include synthesis, comparison, and why/how style questions.";

  const prompt = `You generate study flashcards.

Return ONLY a valid JSON array. No markdown. No extra text.

Generate ${numCards} flashcards at ${difficulty} difficulty from this study content.
${difficultyGuide}

Each item must be:
{
  "question": "...",
  "answer": "...",
  "tags": ["topic"]
}

Rules:
- Questions and answers must stand on their own.
- Do not mention chapter names or document sections.
- Keep answers concise but complete.
- Use lowercase tags.

Content:
${combinedText}`;

  const cards = parseAIJson<FlashcardDraft[]>(
    await invokeLocalOllama(prompt, { temperature: 0.2, numPredict: 2400 }),
  );

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("Local model returned empty flashcard array");
  }

  return cards;
}

async function invokeQuizWithProvider(
  combinedText: string,
  userId: string,
  difficulty: StudyDifficulty,
  numQuestions: number,
  subject?: string,
): Promise<QuizDraft[]> {
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
- Use $...$ for inline math.
- Use $$...$$ for standalone/display equations.
- Apply this to question text, every option, and the explanation — never write raw math without delimiters.

Content:
${combinedText}

Subject: ${subject || "General"}

IMPORTANT: Return ONLY a valid JSON array, no markdown formatting, no code blocks. Example format:
[{"text": "What is $x$ if $2x = 8$?", "options": ["$x = 2$", "$x = 4$", "$x = 6$", "$x = 8$"], "correctAnswer": "$x = 4$", "explanation": "Dividing both sides by 2 gives $x = 4$."}]`;

  const response = await model.invoke([
    new SystemMessage(
      "You are a quiz generation assistant. You MUST respond with ONLY a valid JSON array — no markdown, no code fences, no explanation, no prose before or after. Output raw JSON only.",
    ),
    new HumanMessage(prompt),
  ]);

  const questions = parseAIJson<QuizDraft[]>(response.content.toString());
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI returned empty quiz array");
  }

  return questions;
}

async function invokeQuizLocally(
  combinedText: string,
  difficulty: StudyDifficulty,
  numQuestions: number,
  subject?: string,
): Promise<QuizDraft[]> {
  const difficultyGuide =
    difficulty === "easy"
      ? "Use direct recall and simple conceptual understanding."
      : difficulty === "medium"
        ? "Use application and reasoning based questions."
        : "Use synthesis, analysis, and comparison style questions.";

  const prompt = `You generate multiple-choice quizzes.

Return ONLY a valid JSON array. No markdown. No extra text.

Generate ${numQuestions} ${difficulty} difficulty quiz questions for the subject ${subject || "General"} using this study content.
${difficultyGuide}

Each item must be:
{
  "text": "...",
  "options": ["...", "...", "...", "..."],
  "correctAnswer": "must exactly match one option",
  "explanation": "..."
}

Rules:
- Exactly 4 options per question.
- Only one correct answer.
- Keep explanations brief and useful.
- Keep questions grounded in the provided content.

Content:
${combinedText}`;

  const questions = parseAIJson<QuizDraft[]>(
    await invokeLocalOllama(prompt, { temperature: 0.2, numPredict: 3200 }),
  );

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Local model returned empty quiz array");
  }

  return questions;
}

export async function generateFlashcardsForSpace({
  spaceId,
  userId,
  numCards = 10,
  difficulty = "medium",
}: {
  spaceId: string;
  userId: string;
  numCards?: number;
  difficulty?: StudyDifficulty;
}) {
  await connectDB();

  const contents = await ContentModel.find({ spaceId }).lean();
  if (contents.length === 0) {
    throw new Error("No content in this space to generate flashcards from");
  }

  const combinedText = buildCombinedText(contents);

  let cards: FlashcardDraft[];
  try {
    cards = await invokeFlashcardsWithProvider(
      combinedText,
      userId,
      numCards,
      difficulty,
    );
  } catch (providerError) {
    console.warn(
      "[Flashcards] Provider generation failed, using local Ollama fallback:",
      providerError instanceof Error ? providerError.message : providerError,
    );
    cards = await invokeFlashcardsLocally(combinedText, numCards, difficulty);
  }

  const inserted = await FlashcardModel.insertMany(
    cards.map((card) => ({
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
    })),
  );

  return {
    inserted: inserted.length,
    ids: inserted.map((card) => card._id.toString()),
  };
}

export async function generateQuizForSpace({
  spaceId,
  userId,
  difficulty = "medium",
  numQuestions = 10,
}: {
  spaceId: string;
  userId: string;
  difficulty?: StudyDifficulty;
  numQuestions?: number;
}) {
  await connectDB();

  const [contents, space] = await Promise.all([
    ContentModel.find({ spaceId }).lean(),
    SpaceModel.findById(spaceId).lean(),
  ]);

  if (contents.length === 0) {
    throw new Error("No content in this space to generate quiz from");
  }

  const combinedText = buildCombinedText(contents);

  let questions: QuizDraft[];
  try {
    questions = await invokeQuizWithProvider(
      combinedText,
      userId,
      difficulty,
      numQuestions,
      space?.subject,
    );
  } catch (providerError) {
    console.warn(
      "[Quiz] Provider generation failed, using local Ollama fallback:",
      providerError instanceof Error ? providerError.message : providerError,
    );
    questions = await invokeQuizLocally(
      combinedText,
      difficulty,
      numQuestions,
      space?.subject,
    );
  }

  const quiz = await QuizModel.create({
    spaceId,
    userId,
    title: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz - ${space?.name || "Study Space"}`,
    difficulty,
    questions: questions.map((question, index) => {
      const correctIndex = Array.isArray(question.options)
        ? question.options.indexOf(question.correctAnswer)
        : -1;
      return {
        text: question.text,
        type: "mcq",
        options: question.options || [],
        correctAnswer: correctIndex !== -1 ? correctIndex : 0,
        explanation: question.explanation || "",
        tags: [],
        order: index,
      };
    }),
    attempts: [],
    generatedAt: new Date(),
    isActive: true,
  });

  return {
    quiz: {
      ...quiz.toObject(),
      _id: quiz._id.toString(),
      spaceId,
      userId,
    },
  };
}
