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
// Import the functional factory for the Desmos manager
import { createDynamicDesmosManager } from "./desmos-graph-manager";
import {
  type ChatbotPersonalization,
  buildPersonalizationPrompt,
} from "../services/chatbot-personalization";
import { parseAIJson } from "../utils/parse-ai-json";

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
    const graphKeywords = [
      "graph",
      "plot",
      "visualize",
      "show",
      "draw",
      "sketch",
      "parabola",
      "curve",
      "function",
      "equation",
      "chart",
      "y=",
      "f(x)",
      "x^2",
      "sin",
      "cos",
      "tan",
      "polynomial",
    ];
    const hasGraphIntent = graphKeywords.some((keyword) =>
      queryLower.includes(keyword),
    );
    const mathExpressionPattern =
      /[xy]=|f\([^)]+\)|[xy]\^|\\?sin|\\?cos|\\?tan/i;
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

    // 2. LLM-based intent for Study Tools (Quiz/Flashcard/Summary)
    const toolDetectionPrompt = `Analyze this query: "${userQuery}"
Does it ask for:
1. A quiz to be generated? (quiz, test, exam, practice)
2. Flashcards to be created? (flashcards, cards, review)
3. A summary? (summarize, overview, brief)
4. General tutoring help? (explain, help, understand, what is)

Respond with ONLY ONE word: "quiz", "flashcards", "summary", or "tutoring"`;

    const toolResponse = await model.invoke([
      new HumanMessage(toolDetectionPrompt),
    ]);
    const toolType = toolResponse.content.toString().toLowerCase();

    if (toolType.includes("quiz")) toolsUsed.push("generate_quiz");
    if (toolType.includes("flashcard")) toolsUsed.push("generate_flashcards");
    if (toolType.includes("summary")) toolsUsed.push("generate_summary");

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
  }> => {
    await connectDB();

    // Step 1: Retrieve RAG Content
    const relevantContent = await retrieveRelevantContent(
      userQuery,
      context.spaceId,
      context.userId,
    );

    const ragContext = relevantContent
      .map((c) => c.processed?.rawText || "")
      .join("\n\n")
      .substring(0, 3000);

    // Step 2: Generate the AI text response FIRST.
    // The graph agent will use this response as the primary specification of what to draw,
    // so the AI's explanation and the graph are always in sync.
    const systemPrompt = `You are an expert AI tutor helping a student understand educational content.
${buildPersonalizationPrompt(personalization ?? null)}
Your goal is to:
1. Answer questions clearly and thoroughly
2. Break down complex concepts
3. Provide examples and analogies
4. Encourage deeper understanding
5. Suggest related topics to explore

IMPORTANT: Use LaTeX formatting for all mathematical expressions:
- Inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$
- Display math: $$f(x) = x^2 + 2x + 1$$

If the user asks for a graph, waveform, diagram, or any visualization: describe in detail exactly what should be drawn, including key features, labels, and values. Do NOT provide any code or ask them to run anything — a Desmos visualization will be generated automatically from your description.
${ragContext ? `\nContext from student's materials:\n${ragContext}\n` : ""}`;

    const messages = [
      new SystemMessage(systemPrompt),
      ...context.conversationHistory.map((msg) =>
        msg.role === "user"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content),
      ),
      new HumanMessage(userQuery),
    ];

    const aiModelResponse = await model.invoke(messages);
    const tutorResponse = aiModelResponse.content.toString();

    // Step 3: Orchestrate all tools and agents, passing the AI response so the
    // graph agent knows exactly what to visualize.
    const { toolsUsed, toolResults, visualizations, graphData } =
      await orchestrateAgents(
        userQuery,
        ragContext,
        context,
        images,
        tutorResponse,
      );

    // Step 4: Save conversation (Append to existing history)
    await ChatHistoryModel.updateOne(
      { conversationId: new Types.ObjectId(context.conversationId) },
      {
        $push: {
          messages: {
            $each: [
              { role: "user", content: userQuery, timestamp: new Date() },
              {
                role: "assistant",
                content: tutorResponse,
                timestamp: new Date(),
                toolsUsed,
                visualizations,
              },
            ],
          },
        },
        $addToSet: {
          relatedContentIds: { $each: relevantContent.map((c) => c._id) },
        },
        $set: {
          userId: new Types.ObjectId(context.userId),
          spaceId: new Types.ObjectId(context.spaceId),
          updatedAt: new Date(),
        },
      } as any,
      { upsert: true },
    );

    return {
      response: tutorResponse,
      toolsUsed,
      visualizations,
      graphUpdate: graphData?.finalGraph,
      feedbackLog: graphData?.conversationLog,
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
    const relevantContent = await retrieveRelevantContent(
      userQuery,
      context.spaceId,
      context.userId,
    );
    const ragContext = relevantContent
      .map((c) => c.processed?.rawText || "")
      .join("\n\n")
      .substring(0, 3000);

    let visionContext = "";
    if (images && images.length > 0) {
      visionContext = await analyzeImages(images, userQuery);
    }

    const systemPrompt = `You are an expert AI tutor helping a student understand educational content.
${buildPersonalizationPrompt(personalization ?? null)}
${ragContext ? `\nContext from student's materials:\n${ragContext}\n` : ""}
${visionContext ? `\nImage/diagram analysis:\n${visionContext}\n` : ""}`;

    const messages = [
      new SystemMessage(systemPrompt),
      ...context.conversationHistory.map((msg) =>
        msg.role === "user"
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content),
      ),
      new HumanMessage(userQuery),
    ];

    const stream = await model.stream(messages);

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = typeof chunk === "string" ? chunk : String(chunk);
            controller.enqueue(text);
          }
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
