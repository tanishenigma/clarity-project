import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import { ContentModel } from "@/lib/models";

interface AgentMessage {
  agentId: string;
  type:
    | "task_start"
    | "task_complete"
    | "task_error"
    | "content_ready"
    | "learning_ready";
  contentId?: Types.ObjectId;
  spaceId?: Types.ObjectId;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

// Content Ingestion Agent
export class ContentIngestionAgent {
  private messageQueue: AgentMessage[] = [];

  async processContent(contentId: string, fileBuffer?: Buffer): Promise<void> {
    console.log(
      `[ContentAgent] processContent started \u2014 contentId: ${contentId}`,
    );
    await connectDB();
    const content = await ContentModel.findById(
      new Types.ObjectId(contentId),
    ).lean();

    if (!content) {
      console.error(`[ContentAgent] Content not found: ${contentId}`);
      throw new Error("Content not found");
    }
    console.log(
      `[ContentAgent] Content loaded \u2014 type: ${content.type}, title: "${(content as any).title}", url: ${(content as any).source?.url}`,
    );

    // Emit start event
    this.publishEvent({
      agentId: "content-ingestion",
      type: "task_start",
      contentId: new Types.ObjectId(contentId),
      spaceId: (content as any).spaceId,
      timestamp: new Date(),
    });

    try {
      // Step 1: Extract text based on content type
      let extractedText = "";
      console.log(`[ContentAgent] Extracting text for type: ${content.type}`);

      switch (content.type) {
        case "text":
          extractedText = content.source.url || "";
          console.log(
            `[ContentAgent] Text content loaded (${extractedText.length} chars)`,
          );
          break;
        case "pdf":
          extractedText = await this.extractPdfText(
            (content as any).source?.url || "",
            fileBuffer,
          );
          break;
        case "image":
          extractedText = await this.performOCR(
            (content as any).source?.url || "",
            fileBuffer,
          );
          break;
        case "audio":
        case "video":
          extractedText = await this.transcribeMedia(
            (content as any).source?.url || "",
          );
          break;
        case "link":
          extractedText = await this.scrapeWebContent(
            (content as any).source?.url || "",
          );
          break;
        default:
          console.warn(
            `[ContentAgent] Unknown content type: ${content.type} \u2014 skipping extraction`,
          );
          extractedText = "";
      }
      console.log(
        `[ContentAgent] Extraction complete \u2014 ${extractedText.length} chars extracted`,
      );

      // Step 2: Chunk the text
      const chunks = this.chunkText(extractedText, 500, 100);
      console.log(`[ContentAgent] Chunked into ${chunks.length} chunks`);

      // Step 3: Extract topics (simple keyword extraction for now)
      const topics = this.extractTopics(extractedText);
      console.log(
        `[ContentAgent] Extracted ${topics.length} topics: ${topics.slice(0, 5).join(", ")}`,
      );

      // Step 4: Store processed content
      console.log(`[ContentAgent] Saving processed content to DB\u2026`);
      await ContentModel.updateOne(
        { _id: new Types.ObjectId(contentId) },
        {
          $set: {
            processed: {
              rawText: extractedText,
              chunks: chunks.map((text, index) => ({
                id: `chunk_${contentId}_${index}`,
                text,
                chunkIndex: index,
                vectorId: `vec_${contentId}_${index}`, // Will be filled by vector agent
              })),
              metadata: {
                extractedTopics: topics,
                difficulty: "intermediate",
                language: "en",
              },
              processedAt: new Date(),
            },
            processingStatus: "completed",
          },
        },
      );

      // Emit completion event
      console.log(
        `[ContentAgent] \u2713 Processing complete for contentId: ${contentId}`,
      );
      this.publishEvent({
        agentId: "content-ingestion",
        type: "content_ready",
        contentId: new Types.ObjectId(contentId),
        spaceId: (content as any).spaceId,
        payload: {
          chunkCount: chunks.length,
          topicsExtracted: topics.length,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(
        `[ContentAgent] \u2717 Processing failed for contentId: ${contentId}`,
        error,
      );
      await ContentModel.updateOne(
        { _id: new Types.ObjectId(contentId) },
        {
          $set: {
            processingStatus: "failed",
            processingError:
              error instanceof Error ? error.message : "Unknown error",
          },
        },
      );

      this.publishEvent({
        agentId: "content-ingestion",
        type: "task_error",
        contentId: new Types.ObjectId(contentId),
        spaceId: (content as any).spaceId,
        payload: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
      });
    }
  }

  private async extractPdfText(
    url: string,
    fileBuffer?: Buffer,
  ): Promise<string> {
    if (!url && !fileBuffer) {
      console.warn(
        "[ContentAgent/PDF] No URL or buffer provided, skipping PDF extraction",
      );
      return "";
    }
    try {
      let buffer: Buffer;
      if (fileBuffer) {
        console.log(
          `[ContentAgent/PDF] Using uploaded buffer (${(fileBuffer.length / 1024).toFixed(1)} KB)`,
        );
        buffer = fileBuffer;
      } else {
        console.log(`[ContentAgent/PDF] Downloading PDF from: ${url}`);
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(
            `Failed to fetch PDF: ${response.status} ${response.statusText}`,
          );
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }
      console.log(
        `[ContentAgent/PDF] Downloaded ${(buffer.length / 1024).toFixed(1)} KB, parsing\u2026`,
      );
      const { extractPdfText } = await import("@/lib/utils/pdf-extract");
      const text = await extractPdfText(buffer);
      console.log(`[ContentAgent/PDF] Extracted ${text.length} chars`);
      return text;
    } catch (err) {
      console.error("[ContentAgent/PDF] Extraction failed:", err);
      return "";
    }
  }

  private async performOCR(url: string, fileBuffer?: Buffer): Promise<string> {
    if (!url && !fileBuffer) {
      console.warn(
        "[ContentAgent/OCR] No URL or buffer provided, skipping OCR",
      );
      return "";
    }
    const source = fileBuffer ?? url;
    console.log(
      `[ContentAgent/OCR] Running Tesseract OCR on: ${fileBuffer ? "(buffer)" : url}`,
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = require("tesseract.js");
      const { data } = await Tesseract.recognize(source, "eng", {
        logger: () => {},
      });
      const text = data.text ?? "";
      console.log(`[ContentAgent/OCR] Extracted ${text.length} chars`);
      return text;
    } catch (err) {
      console.error("[ContentAgent/OCR] OCR failed:", err);
      return "";
    }
  }

  private async transcribeMedia(url: string): Promise<string> {
    // TODO: Implement transcription using Whisper API
    console.warn(
      `[ContentAgent/Transcribe] Transcription not implemented yet \u2014 url: ${url}`,
    );
    return "";
  }

  private async scrapeWebContent(url: string): Promise<string> {
    // TODO: Implement web scraping
    console.warn(
      `[ContentAgent/Scrape] Web scraping not implemented yet \u2014 url: ${url}`,
    );
    return "";
  }

  private chunkText(
    text: string,
    chunkSize: number,
    overlap: number,
  ): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private extractTopics(text: string): string[] {
    // Simple keyword extraction (TODO: use NLP for better results)
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 5);
    const uniqueWords = Array.from(new Set(words)).slice(0, 10);
    return uniqueWords;
  }

  private publishEvent(event: AgentMessage): void {
    this.messageQueue.push(event);
    console.log("[Content Agent]", event.type, event.contentId);
  }

  getMessages(): AgentMessage[] {
    return this.messageQueue;
  }
}
