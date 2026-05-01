import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUserAPISettings, createAIClient } from "@/lib/ai-client";
import MindmapModel from "@/lib/models/Mindmap";
import SpaceModel from "@/lib/models/Space";
import ContentModel from "@/lib/models/Content";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";
import { parseAIJson } from "@/lib/utils/parse-ai-json";

// GET - Retrieve persisted mindmap for a space
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    console.log("[Mindmap GET] Fetching mindmap for space:", id);
    const record = await MindmapModel.findOne({ spaceId: id }).lean();
    if (!record) {
      console.log("[Mindmap GET] No mindmap found for space:", id);
      return NextResponse.json({ mindmap: null });
    }
    return NextResponse.json({
      mindmap: {
        nodes: record.nodes,
        edges: record.edges,
        generatedAt: record.generatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching mindmap:", error);
    return NextResponse.json(
      { error: "Failed to fetch mindmap" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    console.log(
      "[Mindmap POST] Starting mindmap generation for space:",
      id,
      "userId:",
      userId,
    );

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const [space, contents, flashcards, quizzes] = await Promise.all([
      SpaceModel.findById(id).lean(),
      ContentModel.find({ spaceId: id }).lean(),
      FlashcardModel.find({ spaceId: id }).lean(),
      QuizModel.find({ spaceId: id }).lean(),
    ]);

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (contents.length === 0 && flashcards.length === 0) {
      return NextResponse.json(
        { error: "No content in this space to generate a mindmap from" },
        { status: 400 },
      );
    }

    // Build a rich context string from available material, capped at 6000 chars
    const contextParts: string[] = [];

    contextParts.push(`Space: "${space.name}"`);
    if (space.subject) contextParts.push(`Subject: ${space.subject}`);
    if (space.examTarget) contextParts.push(`Exam Target: ${space.examTarget}`);
    if (space.description)
      contextParts.push(`Description: ${space.description}`);

    if (contents.length) {
      // Check if any content is still being processed
      const pendingContent = contents.filter(
        (c) => c.processingStatus !== "completed",
      );
      if (pendingContent.length > 0) {
        contextParts.push(
          `\nNote: ${pendingContent.length} document(s) are still being processed and may not appear fully in the mindmap.`,
        );
      }

      const contentContext = contents
        .map((c) => {
          // Fallback chain: rawText → transcript → ocr → chunks joined
          const rawText = c.processed?.rawText ?? "";
          const transcript = c.processed?.transcript ?? "";
          const ocr = c.processed?.ocr ?? "";
          const chunksText = c.processed?.chunks?.length
            ? c.processed.chunks.map((ch) => ch.text).join(" ")
            : "";

          const bestText = rawText || transcript || ocr || chunksText || "";

          return `[${c.type?.toUpperCase() ?? "FILE"}] ${c.title}${
            bestText
              ? "\n" + bestText.substring(0, 3000)
              : " (content not yet processed)"
          }`;
        })
        .join("\n\n");
      contextParts.push("\n--- Study Materials ---\n" + contentContext);
    }

    if (flashcards.length) {
      const fcContext = flashcards
        .slice(0, 50)
        .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
        .join("\n");
      contextParts.push("\n--- Flashcards (sample) ---\n" + fcContext);
    }

    if (quizzes.length) {
      const qContext = quizzes
        .map((q) => q.title)
        .filter(Boolean)
        .join(", ");
      contextParts.push("\n--- Quizzes ---\n" + qContext);
    }

    const contextString = contextParts.join("\n").substring(0, 15000);

    const userSettings = await getUserAPISettings(userId);
    const model = createAIClient("gemini-2.5-flash-lite", 0.3, userSettings);

    const prompt = `You are generating a knowledge mindmap for a student's study space.

Based on the following study materials, create a hierarchical mindmap with 4 levels:
- Level 0: ONE root node (the central topic / space name)
- Level 1: 4–7 major topic nodes (broad subject areas)
- Level 2: 2–4 concept nodes per topic (key ideas/sub-topics)
- Level 3: 1–3 detail nodes per concept (specific facts, formulas, definitions)

Total nodes should be between 25 and 60.

Assign node types: "root", "topic", "concept", "detail".

Edges connect parent → child only (no cross-links).

Study Materials:
${contextString}

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "nodes": [
    {"id": "root", "label": "Central Topic Name", "type": "root"},
    {"id": "t1", "label": "Topic Name", "type": "topic"},
    {"id": "t1_c1", "label": "Concept Name", "type": "concept"},
    {"id": "t1_c1_d1", "label": "Detail fact", "type": "detail"}
  ],
  "edges": [
    {"source": "root", "target": "t1"},
    {"source": "t1", "target": "t1_c1"},
    {"source": "t1_c1", "target": "t1_c1_d1"}
  ]
}

Keep labels concise (max 5 words). Make it educationally meaningful.`;

    const response = await model.invoke([
      new SystemMessage(
        "You are a mindmap generation assistant. You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation, no prose before or after. Output raw JSON only.",
      ),
      new HumanMessage(prompt),
    ]);
    const responseText = response.content.toString();

    let mindmapData;
    try {
      mindmapData = parseAIJson<{ nodes: unknown[]; edges: unknown[] }>(
        responseText,
      );
    } catch (parseError) {
      console.error("[Mindmap] Failed to parse AI response:", responseText);
      return NextResponse.json(
        { error: "Failed to generate mindmap — AI returned invalid JSON" },
        { status: 500 },
      );
    }

    if (
      !mindmapData.nodes ||
      !Array.isArray(mindmapData.nodes) ||
      !mindmapData.edges ||
      !Array.isArray(mindmapData.edges)
    ) {
      return NextResponse.json(
        { error: "Invalid mindmap structure from AI" },
        { status: 500 },
      );
    }

    // Persist (upsert) in the database so it survives logout
    const generatedAt = new Date();
    console.log(
      "[Mindmap POST] Mindmap generated successfully for space:",
      id,
      "- nodes:",
      mindmapData.nodes.length,
      "edges:",
      mindmapData.edges.length,
    );
    await MindmapModel.findOneAndUpdate(
      { spaceId: id },
      {
        $set: {
          nodes: mindmapData.nodes,
          edges: mindmapData.edges,
          generatedAt,
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({ ...mindmapData, generatedAt });
  } catch (error) {
    console.error("Error generating mindmap:", error);
    return NextResponse.json(
      { error: "Failed to generate mindmap" },
      { status: 500 },
    );
  }
}
