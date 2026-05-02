import { AIClient } from "../ai-client";
import type { APISettings } from "../types";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { connectDB } from "../db";
import { Types } from "mongoose";
import { ContentModel, ChatHistoryModel, ConversationModel } from "../models";
import { ragQuery } from "../crag";
import type { Citation } from "../crag";
// Import the functional factory for the Desmos manager
import { createDynamicDesmosManager } from "./desmos-graph-manager";
import {
  type ChatbotPersonalization,
  buildPersonalizationPrompt,
} from "../services/chatbot-personalization";
import { parseAIJson } from "../utils/parse-ai-json";
import {
  generateFlashcardsForSpace,
  generateQuizForSpace,
  type StudyDifficulty,
} from "../services/study-generation";

export interface TutorContext {
  spaceId: string;
  userId: string;
  conversationId: string;
  activeContentIds: string[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ToolResponse {
  toolName: string;
  result: any;
  visualization?: string;
}

/**
 * Functional factory for creating an AI Tutor Agent.
 * Replaces the class-based approach using closures for state management.
 */
export function createAITutorAgent(
  userSettings?: APISettings,
  personalization?: ChatbotPersonalization | null,
) {
  const FLASHCARD_PROMPT_PREFIX =
    "I can generate flashcards for this study space.";
  const QUIZ_PROMPT_PREFIX = "I can generate a quiz for this study space.";

  // --- Private State ---
  const model = new AIClient(
    process.env.AI_MODEL || "gemini-2.5-flash-lite",
    0.8,
    userSettings,
  );

  const visionModel = new AIClient(
    process.env.AI_VISION_MODEL || "gemini-2.5-flash-lite",
    0.7,
    userSettings,
  );

  // Initialize Desmos manager using the functional factory
  const desmosManager = createDynamicDesmosManager(undefined, userSettings);

  // --- Internal/Private Functions ---

  /**
   * Retrieve relevant content via semantic search (simulated)
   * TODO: Integrate with Pinecone vector DB
   */
  const retrieveRelevantContent = async (
    query: string,
    spaceId: string,
    userId: string,
    limit = 5,
  ): Promise<
    Array<{ _id: Types.ObjectId; processed?: { rawText?: string } }>
  > => {
    await connectDB();

    // Validate IDs before querying
    if (!spaceId || spaceId.length !== 24 || !userId || userId.length !== 24) {
      return [];
    }

    try {
      // Simple text search (replace with vector DB search in production)
      const relevantContent = await ContentModel.find({
        spaceId: new Types.ObjectId(spaceId),
        userId: new Types.ObjectId(userId),
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          {
            "processed.metadata.extractedTopics": {
              $regex: query,
              $options: "i",
            },
          },
        ],
      })
        .limit(limit)
        .lean();

      return relevantContent as any[];
    } catch (error) {
      console.error("Error retrieving content:", error);
      return [];
    }
  };

  /**
   * Analyze images for vision-based questions
   */
  const analyzeImages = async (
    imageUrls: string[],
    query: string,
  ): Promise<string> => {
    const imageAnalysisPrompt = `Analyze these educational images in context of the query: "${query}"
Identify:
1. What the images show
2. Key concepts or diagrams
3. How they relate to the query

Be concise and educational.`;

    try {
      const response = await visionModel.invoke([
        new HumanMessage({
          content: [
            { type: "text", text: imageAnalysisPrompt },
            // In production, properly handle image encoding for Gemini
          ],
        }),
      ]);

      return response.content.toString();
    } catch (error) {
      console.error("Vision analysis error:", error);
      return "";
    }
  };

  /**
   * Mathematical analysis agent with symbolic computation
   */
  const runMathAnalysisAgent = async (
    userQuery: string,
    ragContext: string,
  ): Promise<any> => {
    const prompt = `You are a mathematical analysis expert. Solve or analyze this problem:

Query: "${userQuery}"
${ragContext ? `\nContext: ${ragContext}` : ""}

Provide step-by-step solution with clear explanations.
Return JSON:
{
  "steps": ["step 1", "step 2"],
  "final_answer": "answer",
  "latex": "latex representation if applicable"
}`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    const content = response.content.toString();

    try {
      return parseAIJson<any>(content);
    } catch (e) {
      return { steps: [content], final_answer: content };
    }
  };

  /**
   * Orchestrate multiple agents and tool detection
   */
  const orchestrateAgents = async (
    userQuery: string,
    ragContext: string,
    context: TutorContext,
    images?: string[],
    currentAiResponse?: string,
  ): Promise<{
    toolsUsed: string[];
    toolResults: ToolResponse[];
    visualizations: any[];
    graphData?: any;
    visionContext: string;
  }> => {
    const toolsUsed: string[] = [];
    const toolResults: ToolResponse[] = [];
    const visualizations: any[] = [];
    let graphData: any = null;
    let visionContext = "";

    const queryLower = userQuery.toLowerCase();

    // 1. Keyword-based intent for Math & Graphing
    // Only trigger on explicit visual/plotting requests — NOT on words like
    // "function" or "equation" which appear in all technical questions.
    const graphKeywords = [
      "graph",
      "plot",
      "visualize",
      "draw",
      "sketch",
      "parabola",
      "chart",
      "y=",
      "f(x)=",
      "x^2",
    ];
    const hasGraphIntent = graphKeywords.some((keyword) =>
      queryLower.includes(keyword),
    );
    const mathExpressionPattern =
      /[xy]=|f\([^)]+\)=|[xy]\^|\\?sin\s*\(|\\?cos\s*\(|\\?tan\s*\(/i;
    const hasMathExpression = mathExpressionPattern.test(userQuery);

    const mathKeywords = [
      "derivative",
      "integral",
      "solve",
      "simplify",
      "factor",
      "expand",
    ];
    const hasMathAnalysisIntent = mathKeywords.some((keyword) =>
      queryLower.includes(keyword),
    );

    // 2. Keyword-based intent for Study Tools (no external LLM call)
    if (/\b(quiz|test|exam|practice questions)\b/i.test(queryLower))
      toolsUsed.push("generate_quiz");
    if (/\b(flashcard|flash card|cards|review cards)\b/i.test(queryLower))
      toolsUsed.push("generate_flashcards");
    if (/\b(summar|overview|brief|tldr)\b/i.test(queryLower))
      toolsUsed.push("generate_summary");

    // 3. Execute Vision if images provided
    if (images && images.length > 0) {
      toolsUsed.push("vision_understanding");
      visionContext = await analyzeImages(images, userQuery);
      toolResults.push({
        toolName: "vision_understanding",
        result: visionContext,
      });
    }

    // 4. Execute Graphing
    if (hasGraphIntent || hasMathExpression) {
      console.log(" Triggering graph generation...");
      toolsUsed.push("dynamic_graphing");
      try {
        graphData = await desmosManager.startAgentLoop(
          userQuery,
          undefined,
          4,
          context.conversationHistory,
          currentAiResponse,
        );
        toolResults.push({
          toolName: "dynamic_graphing",
          result: graphData.finalGraph,
          visualization: "desmos",
        });
        visualizations.push({
          type: "desmos",
          data: graphData.finalGraph,
          feedbackLog: graphData.conversationLog,
        });
      } catch (error) {
        console.error("Graphing error:", error);
      }
    }

    // 5. Execute Math Analysis
    if (hasMathAnalysisIntent) {
      console.log("Triggering math analysis...");
      toolsUsed.push("math_analysis");
      const mathResult = await runMathAnalysisAgent(userQuery, ragContext);
      toolResults.push({ toolName: "math_analysis", result: mathResult });
    }

    return { toolsUsed, toolResults, visualizations, graphData, visionContext };
  };

  const persistConversationTurn = async ({
    context,
    userQuery,
    assistantContent,
    toolsUsed = [],
    visualizations,
    citations = [],
  }: {
    context: TutorContext;
    userQuery: string;
    assistantContent: string;
    toolsUsed?: string[];
    visualizations?: any[];
    citations?: Citation[];
  }) => {
    await ChatHistoryModel.updateOne(
      { conversationId: new Types.ObjectId(context.conversationId) },
      {
        $push: {
          messages: {
            $each: [
              { role: "user", content: userQuery, timestamp: new Date() },
              {
                role: "assistant",
                content: assistantContent,
                timestamp: new Date(),
                toolsUsed,
                visualizations,
                citations,
              },
            ],
          },
        },
        $addToSet: {
          relatedContentIds: { $each: [] },
        },
        $set: {
          userId: new Types.ObjectId(context.userId),
          spaceId: new Types.ObjectId(context.spaceId),
          updatedAt: new Date(),
        },
      } as any,
      { upsert: true, strict: false },
    );
  };

  const detectStudyGenerationIntent = (
    query: string,
  ): "flashcards" | "quiz" | null => {
    if (
      /\b(generate|create|make|build)\b.*\b(flashcards?|flash cards?|review cards?)\b|\b(flashcards?|flash cards?|review cards?)\b.*\b(generate|create|make|build)\b/i.test(
        query,
      )
    ) {
      return "flashcards";
    }

    if (
      /\b(generate|create|make|build)\b.*\b(quiz|quizzes|test|practice questions?)\b|\b(quiz|quizzes|test|practice questions?)\b.*\b(generate|create|make|build)\b/i.test(
        query,
      )
    ) {
      return "quiz";
    }

    return null;
  };

  const extractDifficulty = (query: string): StudyDifficulty | null => {
    const lower = query.toLowerCase();
    if (lower.includes("easy")) return "easy";
    if (lower.includes("medium")) return "medium";
    if (lower.includes("hard")) return "hard";
    return null;
  };

  const extractCount = (query: string): number | null => {
    const match = query.match(/\b([1-9]|[1-4][0-9]|50)\b/);
    if (!match) return null;
    const count = Number.parseInt(match[1], 10);
    return Number.isFinite(count) ? count : null;
  };

  const getPendingStudyIntent = (
    history: TutorContext["conversationHistory"],
  ): "flashcards" | "quiz" | null => {
    const lastAssistant = [...history]
      .reverse()
      .find((message) => message.role === "assistant")?.content;

    if (!lastAssistant) return null;
    if (lastAssistant.startsWith(FLASHCARD_PROMPT_PREFIX)) return "flashcards";
    if (lastAssistant.startsWith(QUIZ_PROMPT_PREFIX)) return "quiz";
    return null;
  };

  const buildStudyFollowUpPrompt = (
    tool: "flashcards" | "quiz",
    count: number | null,
    difficulty: StudyDifficulty | null,
  ) => {
    const thing = tool === "flashcards" ? "flashcards" : "questions";
    const prefix =
      tool === "flashcards" ? FLASHCARD_PROMPT_PREFIX : QUIZ_PROMPT_PREFIX;

    if (count == null && difficulty == null) {
      return `${prefix} Tell me how many ${thing} you want and the difficulty (easy, medium, or hard). Example: "10 ${tool === "flashcards" ? "medium flashcards" : "medium quiz questions"}".`;
    }

    if (count == null) {
      return `${prefix} I have the difficulty set to ${difficulty}. How many ${thing} should I generate?`;
    }

    return `${prefix} I have the count set to ${count}. What difficulty should I use: easy, medium, or hard?`;
  };

  const maybeHandleStudyToolGeneration = async (
    userQuery: string,
    context: TutorContext,
  ) => {
    const directIntent = detectStudyGenerationIntent(userQuery);
    const pendingIntent = getPendingStudyIntent(context.conversationHistory);
    const count = extractCount(userQuery);
    const difficulty = extractDifficulty(userQuery);
    const looksLikePreferenceReply = count !== null || difficulty !== null;

    const intent =
      directIntent ??
      (pendingIntent && looksLikePreferenceReply ? pendingIntent : null);

    if (!intent) return null;

    if (count == null || difficulty == null) {
      const followUp = buildStudyFollowUpPrompt(intent, count, difficulty);
      await persistConversationTurn({
        context,
        userQuery,
        assistantContent: followUp,
      });
      return {
        response: followUp,
        toolsUsed: [],
        citations: [] as Citation[],
      };
    }

    if (intent === "flashcards") {
      const result = await generateFlashcardsForSpace({
        spaceId: context.spaceId,
        userId: context.userId,
        numCards: count,
        difficulty,
      });

      const assistantContent = `Generated ${result.inserted} ${difficulty} flashcard${result.inserted === 1 ? "" : "s"} for this study space. Open the Flashcards tab to review them.`;
      await persistConversationTurn({
        context,
        userQuery,
        assistantContent,
        toolsUsed: ["generate_flashcards"],
      });
      return {
        response: assistantContent,
        toolsUsed: ["generate_flashcards"],
        citations: [] as Citation[],
      };
    }

    const result = await generateQuizForSpace({
      spaceId: context.spaceId,
      userId: context.userId,
      numQuestions: count,
      difficulty,
    });

    const assistantContent = `Generated a ${difficulty} quiz with ${count} question${count === 1 ? "" : "s"} for this study space. Open the Quizzes tab to start it.`;
    await persistConversationTurn({
      context,
      userQuery,
      assistantContent,
      toolsUsed: ["generate_quiz"],
    });
    return {
      response: assistantContent,
      toolsUsed: ["generate_quiz"],
      citations: [] as Citation[],
    };
  };

  // --- Public API Functions ---

  /**
   * Main tutoring interface with RAG and Multi-Agent Tools
   */
  const handleTutorQuery = async (
    userQuery: string,
    context: TutorContext,
    images?: string[],
  ): Promise<{
    response: string;
    toolsUsed: string[];
    visualizations?: any[];
    graphUpdate?: any;
    feedbackLog?: string[];
    citations?: Citation[];
  }> => {
    await connectDB();

    const studyToolResult = await maybeHandleStudyToolGeneration(
      userQuery,
      context,
    );
    if (studyToolResult) {
      return studyToolResult;
    }

    // Steps 1–3: Corrective RAG pipeline (retrieve → correct → generate via T5 Large)
    const cragResult = await ragQuery(
      userQuery,
      context.spaceId,
      context.userId,
      userSettings,
      context.conversationHistory ?? [],
    );
    const tutorResponse = cragResult.answer;
    const ragContext = cragResult.sources.join("\n\n").substring(0, 3000);
    const citations = cragResult.citations;

    // Step 4: Orchestrate all tools and agents, passing the AI response so the
    // graph agent knows exactly what to visualize.
    const { toolsUsed, toolResults, visualizations, graphData } =
      await orchestrateAgents(
        userQuery,
        ragContext,
        context,
        images,
        tutorResponse,
      );

    // Step 5: Save conversation (Append to existing history)
    await persistConversationTurn({
      context,
      userQuery,
      assistantContent: tutorResponse,
      toolsUsed,
      visualizations,
      citations,
    });

    return {
      response: tutorResponse,
      toolsUsed,
      visualizations,
      graphUpdate: graphData?.finalGraph,
      feedbackLog: graphData?.conversationLog,
      citations,
    };
  };

  /**
   * Stream tutoring response for real-time UI
   */
  const streamTutorResponse = async (
    userQuery: string,
    context: TutorContext,
    images?: string[],
  ): Promise<ReadableStream<string>> => {
    // CRAG pipeline runs synchronously (T5 is not a streaming model);
    // we emit the full answer as a single chunk so callers get a valid stream.
    return new ReadableStream({
      async start(controller) {
        try {
          const cragResult = await ragQuery(
            userQuery,
            context.spaceId,
            context.userId,
            userSettings,
          );
          controller.enqueue(cragResult.answer);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  };

  /**
   * Get or create conversation metadata
   */
  const getOrCreateConversation = async (
    userId: string,
    spaceId: string,
  ): Promise<string> => {
    await connectDB();

    const existing = await ConversationModel.findOne({
      userId: new Types.ObjectId(userId),
      spaceId: new Types.ObjectId(spaceId),
      active: true,
    }).lean();

    if (existing) {
      return (existing as any)._id.toString();
    }

    const created = await ConversationModel.create({
      userId: new Types.ObjectId(userId),
      spaceId: new Types.ObjectId(spaceId),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return created._id.toString();
  };

  /**
   * Get conversation history
   */
  const getConversationHistory = async (
    conversationId: string,
    limit = 10,
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> => {
    if (!conversationId || conversationId.length !== 24) {
      return [];
    }

    try {
      await connectDB();

      const chat = await ChatHistoryModel.findOne({
        conversationId: new Types.ObjectId(conversationId),
      }).lean();

      if (!chat || !(chat as any).messages) {
        return [];
      }

      return (chat as any).messages.slice(-limit).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
    } catch (error) {
      console.error("Error getting conversation history:", error);
      return [];
    }
  };

  // Return the public interface
  return {
    handleTutorQuery,
    streamTutorResponse,
    getOrCreateConversation,
    getConversationHistory,
  };
}
