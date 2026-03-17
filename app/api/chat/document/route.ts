import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { connectDB } from "@/lib/db";
import { AIClient, getUserAPISettings } from "@/lib/ai-client";
import DocumentModel from "@/lib/models/Document";

interface ProcessedFile {
  name: string;
  type: string;
  content: string;
}

// Extract text from PDF
async function extractPdfText(
  buffer: Buffer,
  model: AIClient,
): Promise<string> {
  try {
    // For PDF parsing, we'll use Gemini's vision capabilities
    // as a fallback since pdf-parse has compatibility issues
    const base64 = buffer.toString("base64");
    const response = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: "Extract all text and important information from this PDF document. Be thorough and preserve formatting when possible.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64}`,
            },
          },
        ],
      }),
    ]);

    return typeof response.content === "string"
      ? response.content
      : String(response.content);
  } catch (error) {
    console.error("PDF parsing error:", error);
    // Return a fallback message
    return "PDF file received. Use Gemini Vision to analyze PDF content.";
  }
}

// Extract text from image using Gemini
async function extractImageText(
  buffer: Buffer,
  mimeType: string,
  model: AIClient,
): Promise<string> {
  try {
    const base64 = buffer.toString("base64");
    const response = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
          {
            type: "text",
            text: "Extract all text and important information from this image. Be thorough and preserve formatting when possible.",
          },
        ],
      }),
    ]);

    return typeof response.content === "string"
      ? response.content
      : String(response.content);
  } catch (error) {
    console.error("Image OCR error:", error);
    return "";
  }
}

// Process uploaded files
async function processFiles(
  formData: FormData,
  model: AIClient,
): Promise<ProcessedFile[]> {
  const files = formData.getAll("files") as File[];
  const processedFiles: ProcessedFile[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      let content = "";

      if (file.type === "application/pdf") {
        content = await extractPdfText(buffer, model);
      } else if (file.type.startsWith("image/")) {
        content = await extractImageText(buffer, file.type, model);
      } else if (file.type === "text/plain") {
        content = buffer.toString("utf-8");
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        // For DOCX, we would need a library like mammoth
        // For now, just store the filename
        content = `Document: ${file.name}\n(DOCX files require additional processing)`;
      }

      if (content) {
        processedFiles.push({
          name: file.name,
          type: file.type,
          content: content.substring(0, 10000), // Limit to 10k chars per file
        });
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  return processedFiles;
}

// Store documents in MongoDB
async function storeDocuments(
  files: ProcessedFile[],
  userId: string,
  sessionId: string,
) {
  await connectDB();

  // Validate userId is a valid ObjectId
  if (!userId || userId.length !== 24) {
    console.error("Invalid userId format:", userId);
    throw new Error("Invalid user ID format");
  }

  try {
    for (const file of files) {
      await DocumentModel.create({
        userId,
        sessionId,
        fileName: file.name,
        fileType: file.type,
        content: file.content,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error storing documents:", error);
    throw error;
  }
}

async function generateResponse(
  message: string,
  context: string,
  model: AIClient,
): Promise<string> {
  const systemPrompt = `You are an AI Study Assistant specialized in helping students understand study materials.Use Emojis.

You have access to uploaded study materials. Help the student:
1. Understand complex concepts
2. Answer questions about the materials
3. Provide summaries and explanations
4. Create practice questions if requested
5. Help with homework and assignments

Be clear, educational, and encouraging. If the student asks something not covered in the materials, let them know and still provide helpful information based on your general knowledge.Use Emojis to explain the solutions easily`;

  const userPrompt = context
    ? `Student Question: ${message}\n\nContext from uploaded materials:\n${context}`
    : `Student Question: ${message}`;

  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    return typeof response.content === "string"
      ? response.content
      : String(response.content);
  } catch (error) {
    console.error("Error generating response:", error);
    return "I encountered an error processing your request. Please try again.";
  }
}

// Retrieve relevant documents
async function retrieveRelevantDocuments(
  userId: string,
  sessionId: string,
): Promise<string> {
  await connectDB();

  // Validate userId is a valid ObjectId
  if (!userId || userId.length !== 24) {
    console.error("Invalid userId format:", userId);
    return "";
  }

  try {
    const docs = await DocumentModel.find({
      userId,
      sessionId,
    }).lean();

    return docs
      .map((doc: any) => `File: ${doc.fileName}\n${doc.content}`)
      .join("\n---\n");
  } catch (error) {
    console.error("Error retrieving documents:", error);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const sessionId = formData.get("sessionId") as string;
    const userId = formData.get("userId") as string;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Validate userId format (should be 24-char hex MongoDB ObjectId)
    if (userId.length !== 24 || !/^[0-9a-f]{24}$/i.test(userId)) {
      return NextResponse.json(
        { error: "Invalid userId format" },
        { status: 400 },
      );
    }

    // Process uploaded files if any
    const userSettings = await getUserAPISettings(userId);
    const model = new AIClient(
      process.env.AI_MODEL || "gemini-2.0-flash-exp",
      0.5,
      userSettings,
    );

    const files = formData.getAll("files");
    if (files.length > 0) {
      const processedFiles = await processFiles(formData, model);
      if (processedFiles.length > 0) {
        try {
          await storeDocuments(processedFiles, userId, sessionId);
        } catch (error) {
          console.error("Error storing documents:", error);
          // Don't fail the entire request if document storage fails
          // Continue with response generation
        }
      }
    }

    // Retrieve relevant context from stored documents
    let context = "";
    if (message) {
      context = await retrieveRelevantDocuments(userId, sessionId);
    }

    // Generate response
    const response = await generateResponse(
      message || "Summarize the materials I uploaded",
      context,
      model,
    );

    return NextResponse.json({
      response,
      success: true,
    });
  } catch (error) {
    console.error("Document chat error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 },
    );
  }
}
