import type { NextRequest } from "next/server";
import { AIClient, getUserAPISettings } from "@/lib/ai-client";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import GlobalConversationModel from "@/lib/models/GlobalConversation";
import ChatUploadModel from "@/lib/models/ChatUpload";
import { createDynamicDesmosManager } from "@/lib/agents/desmos-graph-manager";
import {
  extractVideoId,
  fetchYouTubeTranscript,
} from "@/lib/agents/youtube-agent";
import {
  getChatbotPersonalization,
  buildPersonalizationPrompt,
} from "@/lib/services/chatbot-personalization";
import { invokeLocalOllama } from "@/lib/services/study-generation";

import { utapi } from "@/lib/uploadthing";

const MODEL_NAME = process.env.AI_MODEL || "gemini-2.5-flash-lite";

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  publicId: string;
}

// --- HELPER FUNCTIONS ---

async function uploadToUploadThing(file: File): Promise<UploadedFile> {
  const { data, error } = await utapi.uploadFiles(file);
  if (error || !data) {
    throw error ?? new Error("UploadThing returned no result");
  }
  return {
    name: file.name,
    url: data.ufsUrl,
    type: file.type,
    publicId: data.key,
  };
}

async function extractFileContent(
  file: File,
  model: AIClient,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  try {
    // Check for supported image/pdf types
    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      const response = await model.invoke([
        new HumanMessage({
          content: [
            {
              type: "text",
              text: "Extract all text and describe the important information from this document/image. Be thorough.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${base64}`,
              },
            },
          ],
        }),
      ]);
      const content =
        typeof response.content === "string"
          ? response.content
          : String(response.content);
      // Wrap in XML tags for clearer context separation
      return `<file_content name="${file.name}">\n${content}\n</file_content>`;
    } else if (file.type === "text/plain") {
      const text = buffer.toString("utf-8");
      return `<file_content name="${file.name}">\n${text}\n</file_content>`;
    }
  } catch (error) {
    console.error("File extraction error:", error);
  }

  return `[File: ${file.name} (Could not extract content)]`;
}

function serializeMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (!part || typeof part !== "object") {
          return "";
        }

        if (typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }

        if ((part as { type?: unknown }).type === "image_url") {
          return "[image attachment omitted]";
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(content ?? "");
}

const LOCAL_OLLAMA_FALLBACK_NUM_CTX = 16384;
const LOCAL_OLLAMA_FALLBACK_NUM_PREDICT = 4096;
const LOCAL_OLLAMA_FALLBACK_TIMEOUT_MS = 240_000;
const LOCAL_PROMPT_MIN_CHARS = 6000;
const LOCAL_PROMPT_CHARS_PER_TOKEN = 3;
const LOCAL_PROMPT_OMISSION_NOTE =
  "<System>\nEarlier conversation turns were trimmed to fit the local model context window. Focus on the most recent turns.\n</System>";

function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  if (maxChars <= 16) {
    return text.slice(0, maxChars);
  }

  const marker = "\n[...trimmed...]\n";
  const availableChars = maxChars - marker.length;
  const headChars = Math.ceil(availableChars / 2);
  const tailChars = Math.floor(availableChars / 2);

  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`;
}

function estimateLocalPromptMaxChars(
  numCtx: number,
  numPredict: number,
): number {
  const reservedTokens = Math.max(1024, numPredict + 512);
  const promptTokenBudget = Math.max(2048, numCtx - reservedTokens);

  return Math.max(
    LOCAL_PROMPT_MIN_CHARS,
    promptTokenBudget * LOCAL_PROMPT_CHARS_PER_TOKEN,
  );
}

function formatLocalChatSegment(role: string, content: string): string {
  const normalizedContent = content.trim() || "[empty]";
  return `<${role}>\n${normalizedContent}\n</${role}>`;
}

function buildLocalChatPrompt(
  messages: Array<HumanMessage | AIMessage | SystemMessage>,
  assistantInstruction = "Reply to the latest user message naturally. Do not repeat the role tags.",
  { maxChars }: { maxChars?: number } = {},
): string {
  const assistantSuffix = `<Assistant>\n${assistantInstruction}`;

  const segments = messages.map((message) => {
    const role =
      message instanceof SystemMessage
        ? "System"
        : message instanceof AIMessage
          ? "Assistant"
          : "User";

    return {
      role,
      text: formatLocalChatSegment(
        role,
        serializeMessageContent(message.content),
      ),
    };
  });

  const fullTranscript = segments.map((segment) => segment.text).join("\n\n");
  const fullPrompt = `${fullTranscript}\n\n${assistantSuffix}`;

  if (!maxChars || fullPrompt.length <= maxChars) {
    return fullPrompt;
  }

  if (assistantSuffix.length >= maxChars) {
    return truncateMiddle(assistantSuffix, maxChars);
  }

  const transcriptBudget = maxChars - assistantSuffix.length - 2;
  const systemSegments = segments
    .filter((segment) => segment.role === "System")
    .map((segment) => segment.text);
  const nonSystemSegments = segments
    .filter((segment) => segment.role !== "System")
    .map((segment) => segment.text);

  const rawSystemBlock = systemSegments.join("\n\n");
  const maxSystemChars = rawSystemBlock
    ? Math.min(
        rawSystemBlock.length,
        Math.max(1200, Math.floor(transcriptBudget * 0.25)),
      )
    : 0;
  const systemBlock = rawSystemBlock
    ? truncateMiddle(rawSystemBlock, maxSystemChars)
    : "";

  let remainingConversationChars = transcriptBudget - systemBlock.length;
  if (systemBlock) {
    remainingConversationChars -= 2;
  }

  const selectedConversationSegments: string[] = [];
  let droppedEarlierTurns = false;

  for (let index = nonSystemSegments.length - 1; index >= 0; index -= 1) {
    const segment = nonSystemSegments[index];
    const separatorChars = selectedConversationSegments.length > 0 ? 2 : 0;

    if (segment.length + separatorChars <= remainingConversationChars) {
      selectedConversationSegments.unshift(segment);
      remainingConversationChars -= segment.length + separatorChars;
      continue;
    }

    droppedEarlierTurns = true;
    if (
      selectedConversationSegments.length === 0 &&
      remainingConversationChars > 64
    ) {
      selectedConversationSegments.unshift(
        truncateMiddle(segment, remainingConversationChars),
      );
      remainingConversationChars = 0;
    }
    break;
  }

  if (
    droppedEarlierTurns &&
    selectedConversationSegments.length > 0 &&
    LOCAL_PROMPT_OMISSION_NOTE.length + 2 <= remainingConversationChars
  ) {
    selectedConversationSegments.unshift(LOCAL_PROMPT_OMISSION_NOTE);
  }

  const trimmedTranscript = [systemBlock, ...selectedConversationSegments]
    .filter(Boolean)
    .join("\n\n");

  return `${trimmedTranscript}\n\n${assistantSuffix}`;
}

async function invokeWithOllamaFallback(
  model: AIClient,
  messages: Array<HumanMessage | AIMessage | SystemMessage>,
  options: {
    assistantInstruction?: string;
    temperature?: number;
    numPredict?: number;
    numCtx?: number;
    timeoutMs?: number;
    maxPromptChars?: number;
  } = {},
): Promise<string> {
  try {
    const response = await model.invoke(messages);
    return serializeMessageContent(response.content).trim();
  } catch (providerError) {
    const numPredict = options.numPredict ?? 2048;
    const numCtx = options.numCtx ?? LOCAL_OLLAMA_FALLBACK_NUM_CTX;

    console.warn(
      "[GlobalChat] Provider invoke failed, trying local Ollama fallback:",
      providerError instanceof Error ? providerError.message : providerError,
    );

    return (
      await invokeLocalOllama(
        buildLocalChatPrompt(messages, options.assistantInstruction, {
          maxChars:
            options.maxPromptChars ??
            estimateLocalPromptMaxChars(numCtx, numPredict),
        }),
        {
          temperature: options.temperature ?? 0.35,
          numPredict,
          numCtx,
          timeoutMs: options.timeoutMs ?? 90_000,
        },
      )
    ).trim();
  }
}

// --- MAIN HANDLER ---

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let conversationId = "";
    let userId = "";
    let files: File[] = [];

    // 1. Parse Input
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = (formData.get("message") as string) || "";
      conversationId = formData.get("conversationId") as string;
      userId = formData.get("userId") as string;
      files = formData.getAll("files") as File[];
    } else {
      const json = await request.json();
      message = json.message;
      conversationId = json.conversationId;
      userId = json.userId;
    }

    if ((!message && files.length === 0) || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 },
      );
    }

    console.log("Global chat API called:", {
      message: message?.substring(0, 80),
      userId,
      conversationId: conversationId || "(new)",
      files: files.length,
    });

    // 2. Initialize AI with user's configured keys
    const [userSettings, chatPersonalization] = await Promise.all([
      getUserAPISettings(userId),
      getChatbotPersonalization(userId),
    ]);
    const personalizationPrompt =
      buildPersonalizationPrompt(chatPersonalization);
    const model = new AIClient(MODEL_NAME, 0.7, userSettings);
    console.log("AI client initialized with model:", MODEL_NAME);

    // Detect graph intent from keywords in the current message OR recent history.
    // Checking history handles cases like "regenerate that graph" / "show me that"
    // where the explicit keyword appeared in a previous turn.
    const graphKeywords = [
      "graph",
      "plot",
      "visualize",
      "draw",
      "sketch",
      "parabola",
      "curve",
      "waveform",
      "diagram",
      "signal",
      "encoding",
      "chart",
      "y=",
      "f(x)",
      "x^2",
      "sin",
      "cos",
      "tan",
      "polynomial",
    ];
    const mathExpressionPattern =
      /[xy]=|f\([^)]+\)|[xy]\^|\\?sin|\\?cos|\\?tan/i;
    const regeneratePattern =
      /\b(regenerate|redo|again|redraw|re-?generate|show again)\b/i;
    // Explicit negation — user wants explanation only, no graph
    const graphNegationPattern =
      /\b(without|no|don'?t|do not|not|skip|avoid|just|only|instead)\b.{0,30}\b(graph|plot|draw|visualize|diagram|chart|waveform)\b|\b(graph|plot|draw|visualize|diagram|chart|waveform)\b.{0,20}\b(not|without|no need)\b/i;

    // Scan current message
    const msgLower = (message || "").toLowerCase();
    let hasGraphIntent =
      !graphNegationPattern.test(message || "") &&
      (graphKeywords.some((kw) => msgLower.includes(kw)) ||
        mathExpressionPattern.test(message || ""));

    console.log(" Graph intent detected (initial):", hasGraphIntent);

    // 3. Process Files (Upload & Extract)
    const uploadedFiles: UploadedFile[] = [];
    let fileContext = "";

    if (files.length > 0) {
      // Process concurrently for speed
      await Promise.all(
        files.map(async (file) => {
          const [uploaded, extracted] = await Promise.all([
            uploadToUploadThing(file),
            extractFileContent(file, model),
          ]);

          uploadedFiles.push(uploaded);
          fileContext += `\n${extracted}`;
        }),
      );
    }

    // 4. Database & Conversation Management
    await connectDB();

    let conversation: any = null;
    let currentConversationId: Types.ObjectId;
    let isNewConversation = false;

    // Validate ID format (must be 24 hex chars)
    if (conversationId && /^[0-9a-fA-F]{24}$/.test(conversationId)) {
      conversation = await GlobalConversationModel.findOne({
        _id: conversationId,
        userId, // Ensure ownership
      }).lean();
    }

    if (!conversation) {
      isNewConversation = true;

      // Generate a smart title before creating the conversation
      let smartTitle = message?.substring(0, 50) || "New Conversation";
      if (message) {
        try {
          const generated = await invokeWithOllamaFallback(
            model,
            [
              new SystemMessage(
                "You generate ultra-short conversation titles. Reply with ONLY 3-6 words that capture the essence of the user's request. No punctuation, no quotes, no explanation.",
              ),
              new HumanMessage(
                `User asked: "${message.substring(0, 200)}"

Respond with a 3-6 word title only.`,
              ),
            ],
            {
              assistantInstruction:
                "Respond with only a 3-6 word title. No punctuation, no quotes, no explanation.",
              temperature: 0.2,
              numPredict: 80,
            },
          );

          if (generated) smartTitle = generated.substring(0, 60);
        } catch {
          // fallback to truncated message
        }
      }

      const newConversation = await GlobalConversationModel.create({
        userId,
        title: smartTitle,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      currentConversationId = newConversation._id;
      conversation = newConversation.toObject();
    } else {
      currentConversationId = conversation._id;
    }

    // Re-check graph intent using conversation history now that it's loaded.
    // Handles "regenerate that" / "show it again" style messages.
    if (!hasGraphIntent && regeneratePattern.test(message || "")) {
      const recentText = (conversation?.messages || [])
        .slice(-6)
        .map((m: any) => m.content || "")
        .join(" ")
        .toLowerCase();
      if (graphKeywords.some((kw) => recentText.includes(kw))) {
        hasGraphIntent = true;
      }
    }
    console.log(" Graph intent detected (final):", hasGraphIntent);
    // Load history
    const rawHistory: Array<{ role: "user" | "assistant"; content: string }> = (
      conversation.messages || []
    ).map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const historyMessages = rawHistory.map((msg) =>
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    // 5a. Detect YouTube URLs and fetch transcripts + metadata
    const youtubeUrlPattern =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w\-]+(?:[\?&][^\s]*)*/gi;
    const youtubeUrls = (message || "").match(youtubeUrlPattern) ?? [];
    let youtubeContext = "";

    if (youtubeUrls.length > 0) {
      for (const ytUrl of youtubeUrls) {
        const videoId = extractVideoId(ytUrl);
        if (!videoId) continue;
        console.log("[YouTubeAgent] YouTube intent detected:", ytUrl);
        try {
          const videoInfo = await fetchYouTubeTranscript(ytUrl);
          console.log(
            `[YouTubeAgent] Video info fetched for ${videoId}:`,
            `title="${videoInfo.title}"`,
            `transcriptAvailable=${videoInfo.transcriptAvailable}`,
            `transcriptLength=${videoInfo.transcript.length}`,
          );

          youtubeContext += `\n<youtube_video video_id="${videoId}" url="${ytUrl}">\n`;
          youtubeContext += `Title: ${videoInfo.title}\n`;
          youtubeContext += `Channel: ${videoInfo.author}\n`;
          if (videoInfo.viewCount)
            youtubeContext += `Views: ${videoInfo.viewCount}\n`;
          if (videoInfo.description)
            youtubeContext += `\nDescription:\n${videoInfo.description}\n`;
          if (videoInfo.transcriptAvailable && videoInfo.transcript) {
            youtubeContext += `\nFull Transcript:\n${videoInfo.transcript}\n`;
          } else {
            youtubeContext += `\n[Transcript: Not available from server — captions exist but the caption API is geo/IP restricted from this server. Use the title, description, and your knowledge to discuss this video.]\n`;
          }
          youtubeContext += `</youtube_video>\n`;
        } catch (ytErr) {
          console.warn(
            `[YouTubeAgent] Failed to fetch video info for ${ytUrl}:`,
            ytErr,
          );
          youtubeContext += `\n<youtube_video video_id="${videoId}" url="${ytUrl}">\n[Video info unavailable — ${ytErr instanceof Error ? ytErr.message : "unknown error"}]\n</youtube_video>\n`;
        }
      }
    }

    // Combine user prompt with file context and YouTube transcript
    // This combined message is what we send to LLM and save to DB
    let finalUserContent = fileContext
      ? `${message}\n\nHere is the content of the uploaded files:\n${fileContext}`
      : message;

    if (youtubeContext) {
      finalUserContent += `\n\nThe following YouTube transcript(s) have been automatically retrieved for you:\n${youtubeContext}`;
    }

    const systemMessage = new SystemMessage(
      `You are a helpful AI Learning Assistant. You provide educational support.
       ${personalizationPrompt}
       If the user has uploaded files, their content is provided within <file_content> tags.
       If the user has shared a YouTube link, video metadata (title, channel, description, and transcript when available) is provided within <youtube_video> tags.
       When a transcript IS provided, use it fully to summarise, analyse, or answer questions.
       When a transcript is NOT available (server-side IP restriction), use the title, description, and your own knowledge of the video/topic to provide a helpful analysis — never tell the user you "cannot" access or read the video.
       Use this content to answer their questions. Be friendly and clear.
       Use LaTeX formatting for all mathematical expressions: inline with $...$ and display with $$...$$.

       CRITICAL — GRAPH & VISUALIZATION CAPABILITY:
       You have a fully integrated Desmos graph agent. You are ALWAYS able to generate graphs, waveforms, diagrams, signal timing charts, and any other visual.
       RULES YOU MUST NEVER BREAK:
       1. NEVER say you "cannot", "am unable to", or "don't have the ability to" generate graphs or visuals. You always can.
       2. NEVER apologize for lacking graph capabilities. You have them.
       3. NEVER ask the user to draw it themselves or use a separate tool.
       4. When the user asks for any graph or visualization: confirm you are generating it, then describe in precise detail what it shows — signal levels, voltage transitions, axis labels, bit periods, key values, annotations, etc. Your description is the exact specification the graph agent uses to draw.
       5. Do NOT output code. Do NOT tell the user to run anything.
       ${
         hasGraphIntent
           ? `\n       The current request is a graph/visualization request. Follow rules 1-5 above strictly.`
           : ""
       }`,
    );

    const modelMessages = [
      systemMessage,
      ...historyMessages,
      new HumanMessage(finalUserContent),
    ];

    // Graph manager is created here but the agent loop runs AFTER the text
    // stream completes, so it can use the AI's full response as context.
    const desmosManager = hasGraphIntent
      ? createDynamicDesmosManager(undefined, userSettings)
      : null;

    // 6. Stream Response
    const encoder = new TextEncoder();

    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          console.log("Starting stream...");
          let fullResponse = "";

          try {
            // AIClient.stream() is an async generator that yields string chunks
            const stream = model.stream(modelMessages);

            for await (const chunk of stream) {
              fullResponse += chunk;
              try {
                controller.enqueue(encoder.encode(chunk));
              } catch (enqueueError: any) {
                // Controller closed (client disconnected or stream cancelled)
                if (enqueueError?.code === "ERR_INVALID_STATE") {
                  console.warn("[Stream] Controller closed, stopping stream.");
                  return;
                }
                throw enqueueError;
              }
            }
          } catch (providerError) {
            if (fullResponse.length > 0) {
              throw providerError;
            }

            console.warn(
              "[GlobalChat] Provider stream failed, trying local Ollama fallback:",
              providerError instanceof Error
                ? providerError.message
                : providerError,
            );

            fullResponse = await invokeLocalOllama(
              buildLocalChatPrompt(modelMessages, undefined, {
                maxChars: estimateLocalPromptMaxChars(
                  LOCAL_OLLAMA_FALLBACK_NUM_CTX,
                  LOCAL_OLLAMA_FALLBACK_NUM_PREDICT,
                ),
              }),
              {
                temperature: 0.35,
                numPredict: LOCAL_OLLAMA_FALLBACK_NUM_PREDICT,
                numCtx: LOCAL_OLLAMA_FALLBACK_NUM_CTX,
                timeoutMs: LOCAL_OLLAMA_FALLBACK_TIMEOUT_MS,
                continueOnLength: true,
                maxContinuations: 3,
              },
            );

            if (!fullResponse.trim()) {
              throw providerError;
            }

            try {
              controller.enqueue(encoder.encode(fullResponse));
            } catch (enqueueError: any) {
              if (enqueueError?.code === "ERR_INVALID_STATE") {
                console.warn("[Stream] Controller closed, stopping stream.");
                return;
              }
              throw enqueueError;
            }
          }

          // Run graph generation AFTER the stream so the agent has the AI's
          // full response as the primary specification of what to draw.
          let graphData: { finalGraph: any; conversationLog: string[] } | null =
            null;
          if (desmosManager) {
            console.log(
              "Starting Desmos agent loop (post-stream, with AI context)...",
            );
            try {
              graphData = await desmosManager.startAgentLoop(
                message || "",
                undefined,
                3,
                rawHistory,
                fullResponse,
              );
            } catch (err) {
              console.error("Graph generation error:", err);
            }
          }

          if (graphData?.finalGraph?.expressions?.length) {
            console.log("Appending graph data:", {
              expressions: graphData.finalGraph.expressions.length,
              hasViewport: !!graphData.finalGraph.viewport,
            });
            const marker = `\n__GRAPH__:${JSON.stringify({
              finalGraph: graphData.finalGraph,
              conversationLog: graphData.conversationLog,
            })}`;
            try {
              controller.enqueue(encoder.encode(marker));
            } catch (enqueueError: any) {
              if (enqueueError?.code !== "ERR_INVALID_STATE")
                throw enqueueError;
            }
          }

          // 7. Save to Database (After stream completes successfully)
          // Save the original user message (without injected YouTube/file context)
          // so the chat history displays cleanly. The injected context only lives
          // in the LLM call for this turn.
          const newMessages = [
            {
              role: "user",
              content: message, // Display-safe: no injected YouTube XML or file blobs
              files: uploadedFiles,
              timestamp: new Date(),
            },
            {
              role: "assistant",
              content: fullResponse,
              graphUpdate: graphData?.finalGraph ?? null,
              feedbackLog: graphData?.conversationLog ?? null,
              timestamp: new Date(),
            },
          ];

          await GlobalConversationModel.updateOne(
            { _id: currentConversationId },
            {
              $push: { messages: { $each: newMessages } } as any,
              $set: { updatedAt: new Date() },
            },
          );

          // Save uploads to separate collection if needed
          if (uploadedFiles.length > 0) {
            await ChatUploadModel.create({
              userId,
              conversationId: currentConversationId,
              files: uploadedFiles,
              uploadedAt: new Date(),
            });
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          // Send a readable error to the client instead of silently killing the connection
          const userMessage =
            "\n\n⚠️ I’m having trouble reaching the AI service right now. " +
            "Please check your API keys in Settings, or try again in a moment.";
          try {
            controller.enqueue(encoder.encode(userMessage));
            controller.close();
          } catch {
            controller.error(error);
          }
        }
      },
    });

    // 8. Return Response with ID Header
    return new Response(customReadable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // CRITICAL: Send the Conversation ID to the client
        "X-Conversation-Id": currentConversationId.toString(),
        "X-Is-New-Conversation": isNewConversation ? "true" : "false",
      },
    });
  } catch (error: any) {
    console.error("Global chat error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Global chat failed" }),
      { status: 500 },
    );
  }
}
