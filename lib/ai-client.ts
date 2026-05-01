import { connectDB } from "./db";
import { UserModel } from "./models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { EuriClient } from "euri";
import Groq from "groq-sdk";
import type { BaseMessage } from "@langchain/core/messages";
import type { APISettings } from "./types";

type ProviderName = "gemini" | "openai" | "euri" | "groq";

/**
 * AI Client with dynamic provider routing and automatic fallback.
 *
 * - Uses the user's configured primary provider first.
 * - If the primary provider's key is not available, skips it immediately
 *   and goes straight to the next available provider — no wasted timeout.
 * - Provider timeouts (30s) only kick in when a key IS present but the
 *   network / upstream is slow.
 */
export class AIClient {
  private geminiModel?: ChatGoogleGenerativeAI;
  private euriClient?: EuriClient;
  private groqClient?: Groq;

  private primaryProvider: ProviderName;
  private fallbackOrder: ProviderName[];
  private modelName: string;
  private temperature: number;
  private jsonMode: boolean;
  /** True when no API keys are configured — invoke/stream will throw lazily. */
  private noProvidersAvailable = false;

  constructor(
    modelName?: string,
    temperature?: number,
    userSettings?: APISettings,
    /** Force JSON output mode on providers that support it (Gemini, Groq). */
    jsonMode = false,
  ) {
    this.jsonMode = jsonMode;
    this.modelName =
      modelName || process.env.AI_MODEL || "gemini-2.5-flash-lite";
    this.temperature = temperature ?? 0.7;

    // --- Initialise every provider whose key is available ---

    const geminiKey =
      userSettings?.apiKeys?.gemini || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.geminiModel = new ChatGoogleGenerativeAI({
        model: this.modelName,
        apiKey: geminiKey,
        temperature: this.temperature,
        maxOutputTokens: 8192,
        ...(jsonMode && {
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        }),
      });
    }

    const euriKey = userSettings?.apiKeys?.euri || process.env.EURI_API_KEY;
    if (euriKey) {
      this.euriClient = new EuriClient({ apiKey: euriKey });
    }

    const groqKey = userSettings?.apiKeys?.groq || process.env.GROQ_API_KEY;
    if (groqKey) {
      this.groqClient = new Groq({ apiKey: groqKey });
    }

    // --- Resolve primary provider ---

    // Start with what the user configured (or default to gemini)
    let preferred: ProviderName =
      (userSettings?.primaryProvider as ProviderName) || "gemini";

    // If the preferred provider has no key, auto-downgrade to the first available
    if (!this.isAvailable(preferred)) {
      const order: ProviderName[] = ["gemini", "euri", "groq"];
      const available = order.find((p) => this.isAvailable(p));
      if (!available) {
        console.warn(
          "[AIClient] No AI provider keys configured — LLM calls will fail gracefully. Using local T5 via CRAG.",
        );
        this.noProvidersAvailable = true;
        this.primaryProvider = "gemini"; // sentinel; invoke will throw if called
        this.fallbackOrder = [];
        return;
      }
      console.warn(
        `Primary provider "${preferred}" has no key — using "${available}" instead.`,
      );
      preferred = available;
    }

    this.primaryProvider = preferred;

    // --- Build fallback chain (exclude primary; respect user's fallback pref) ---
    this.fallbackOrder = [];
    const fallbackEnabled = userSettings?.fallbackEnabled !== false;

    if (fallbackEnabled) {
      const preferredFallback = userSettings?.fallbackProvider as
        | ProviderName
        | undefined;

      const candidates: ProviderName[] = ["gemini", "euri", "groq"];

      if (preferredFallback) {
        // User has explicitly chosen a fallback provider — honour it exclusively.
        // Do NOT silently append other providers: if this one is unavailable or
        // fails, the request should error rather than fall through to an
        // unexpected provider.
        if (
          preferredFallback !== this.primaryProvider &&
          this.isAvailable(preferredFallback)
        ) {
          this.fallbackOrder.push(preferredFallback);
        } else if (preferredFallback !== this.primaryProvider) {
          console.warn(
            `[AIClient] User-specified fallback "${preferredFallback}" has no key — no fallback will be used.`,
          );
        }
      } else {
        // No explicit fallback preference: try all other available providers in
        // default order.
        for (const p of candidates) {
          if (p !== this.primaryProvider && this.isAvailable(p)) {
            this.fallbackOrder.push(p);
          }
        }
      }
    }
  }

  private isAvailable(provider: ProviderName): boolean {
    switch (provider) {
      case "gemini":
        return !!this.geminiModel;
      case "euri":
        return !!this.euriClient;
      case "groq":
        return !!this.groqClient;
      default:
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Public: invoke (non-streaming)
  // -------------------------------------------------------------------------

  async invoke(messages: BaseMessage[]): Promise<{ content: string }> {
    if (this.noProvidersAvailable) {
      throw new Error(
        "No AI provider keys configured. Please add at least one API key in Settings.",
      );
    }
    // Try primary
    try {
      return await this.invokeProvider(this.primaryProvider, messages);
    } catch (error) {
      console.error(`[AIClient] ${this.primaryProvider} invoke failed:`, error);
    }

    // Try fallbacks in order
    for (const provider of this.fallbackOrder) {
      try {
        console.log(`[AIClient] Falling back to ${provider}…`);
        return await this.invokeProvider(provider, messages);
      } catch (err) {
        console.error(`[AIClient] ${provider} also failed:`, err);
      }
    }

    throw new Error(
      `All AI providers failed (tried: ${this.primaryProvider}, ${this.fallbackOrder.join(", ")})`,
    );
  }

  // -------------------------------------------------------------------------
  // Public: stream (async generator, yields string chunks)
  // -------------------------------------------------------------------------

  async *stream(
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    if (this.noProvidersAvailable) {
      throw new Error(
        "No AI provider keys configured. Please add at least one API key in Settings.",
      );
    }
    // Track whether we've already sent data to the consumer.
    // If we have, falling back to another provider would concatenate two
    // different responses and corrupt the stream — so we throw instead.
    let hasYieldedData = false;

    // Try primary
    try {
      for await (const chunk of this.streamProvider(
        this.primaryProvider,
        messages,
      )) {
        hasYieldedData = true;
        yield chunk;
      }
      return;
    } catch (error) {
      console.error(`[AIClient] ${this.primaryProvider} stream failed:`, error);
      if (hasYieldedData) {
        // Already sent partial data — can't cleanly swap providers.
        throw error;
      }
    }

    // Try fallbacks in order (only safe when no data has been yielded yet)
    for (const provider of this.fallbackOrder) {
      try {
        console.log(`[AIClient] Stream falling back to ${provider}…`);
        for await (const chunk of this.streamProvider(provider, messages)) {
          hasYieldedData = true;
          yield chunk;
        }
        return;
      } catch (err) {
        console.error(`[AIClient] ${provider} stream also failed:`, err);
      }
    }

    throw new Error(
      `All AI providers failed during streaming (tried: ${this.primaryProvider}, ${this.fallbackOrder.join(", ")}).`,
    );
  }

  // -------------------------------------------------------------------------
  // Private: route to specific provider
  // -------------------------------------------------------------------------

  /**
   * Normalise the content field of any provider response so callers always
   * receive a plain `{ content: string }` object regardless of provider.
   *
   * Gemini (via LangChain) can return an AIMessage whose `.content` is an
   * array of content-part objects for multimodal responses.  All other
   * providers already return a plain string.
   */
  private normalizeResponse(raw: any): { content: string } {
    const content = raw?.content;
    if (typeof content === "string") return { content };
    if (Array.isArray(content)) {
      const text = (content as any[])
        .map((part) => {
          if (typeof part === "string") return part;
          if (typeof part?.text === "string") return part.text;
          if (typeof part?.content === "string") return part.content;
          return "";
        })
        .join("");
      return { content: text };
    }
    return { content: String(content ?? "") };
  }

  private async invokeProvider(
    provider: ProviderName,
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    switch (provider) {
      case "gemini":
        return this.normalizeResponse(await this.geminiModel!.invoke(messages));
      case "euri":
        return await this.invokeEuri(messages);
      case "groq":
        return await this.invokeGroq(messages);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async *streamProvider(
    provider: ProviderName,
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    switch (provider) {
      case "gemini": {
        const stream = this.geminiModel!.stream(messages);
        for await (const chunk of await stream) {
          if (chunk.content) {
            yield typeof chunk.content === "string"
              ? chunk.content
              : Array.isArray(chunk.content)
                ? (chunk.content as any[])
                    .map((p: any) =>
                      typeof p === "string" ? p : (p?.text ?? p?.content ?? ""),
                    )
                    .join("")
                : String(chunk.content);
          }
        }
        break;
      }
      case "euri": {
        const res = await this.invokeEuri(messages);
        yield typeof res.content === "string"
          ? res.content
          : String(res.content);
        break;
      }
      case "groq": {
        const res = await this.invokeGroq(messages);
        yield typeof res.content === "string"
          ? res.content
          : String(res.content);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // -------------------------------------------------------------------------
  // Private: provider-specific implementations
  // -------------------------------------------------------------------------

  private async invokeEuri(messages: BaseMessage[]): Promise<any> {
    const prompt = this.convertMessagesToPrompt(messages);
    const response = await this.euriClient!.complete(prompt, "gpt-5-nano");
    return { content: response };
  }

  private async invokeGroq(messages: BaseMessage[]): Promise<any> {
    const groqMessages = messages.map((msg) => {
      const role = msg._getType();
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      if (role === "system") return { role: "system" as const, content };
      if (role === "human") return { role: "user" as const, content };
      if (role === "ai") return { role: "assistant" as const, content };
      return { role: "user" as const, content };
    });

    const completion = await this.groqClient!.chat.completions.create({
      messages: groqMessages,
      model: "llama-3.3-70b-versatile",
      temperature: this.temperature,
      max_tokens: 4096,
      ...(this.jsonMode && { response_format: { type: "json_object" } }),
    });

    return { content: completion.choices[0]?.message?.content || "" };
  }

  private convertMessagesToPrompt(messages: BaseMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg._getType();
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        if (role === "system") return `System: ${content}`;
        if (role === "human") return `User: ${content}`;
        if (role === "ai") return `Assistant: ${content}`;
        return content;
      })
      .join("\n\n");
  }

  /** Expose primary provider name for logging / debugging */
  getPrimaryProvider(): ProviderName {
    return this.primaryProvider;
  }

  /** Legacy: returns the underlying Gemini model when available */
  getGeminiModel(): ChatGoogleGenerativeAI {
    if (!this.geminiModel) {
      throw new Error("Gemini is not configured.");
    }
    return this.geminiModel;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createAIClient(
  modelName?: string,
  temperature?: number,
  userSettings?: APISettings,
  jsonMode = false,
): AIClient {
  return new AIClient(modelName, temperature, userSettings, jsonMode);
}

export async function getUserAPISettings(
  userId: string,
): Promise<APISettings | undefined> {
  try {
    await connectDB();
    const user = await UserModel.findById(userId, { apiSettings: 1 }).lean();
    return (user as any)?.apiSettings;
  } catch (error) {
    console.error("Error fetching user API settings:", error);
    return undefined;
  }
}
