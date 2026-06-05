/**
 * Universal AI Client
 *
 * Provider-agnostic AI service layer. Supports:
 *   Cloud:  Gemini · OpenAI · Anthropic (Claude) · Groq · OpenRouter
 *   Local:  Ollama · LM Studio · vLLM · any OpenAI-compatible endpoint
 *
 * Public interface:
 *   invoke(messages)  → { content: string }
 *   stream(messages)  → AsyncGenerator<string>
 *
 * Provider-specific logic is fully isolated here; callers never need to
 * know which provider is active.
 */

import { connectDB } from "./db";
import { UserModel } from "./models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Groq from "groq-sdk";
import type { BaseMessage } from "@langchain/core/messages";
import type { APISettings, ProviderName } from "./types";
import { DEFAULT_MODELS, LOCAL_PROVIDERS } from "./providers/types";

// ---------------------------------------------------------------------------
// AIClient
// ---------------------------------------------------------------------------

export class AIClient {
  private geminiModel?: ChatGoogleGenerativeAI;
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI; // OpenAI, OpenRouter, LM Studio, vLLM
  private groqClient?: Groq;
  private ollamaBaseURL?: string; // Ollama uses native fetch to avoid SDK/webpack issues

  private primaryProvider: ProviderName;
  private fallbackOrder: ProviderName[];
  private modelName: string;
  private temperature: number;
  private jsonMode: boolean;
  private noProvidersAvailable = false;

  // Which openai-compatible provider this client represents
  private openaiProviderName?: ProviderName;

  constructor(
    modelName?: string,
    temperature?: number,
    userSettings?: APISettings,
    jsonMode = false,
  ) {
    this.jsonMode = jsonMode;
    this.temperature = temperature ?? 0.7;

    const primary: ProviderName =
      (userSettings?.primaryProvider as ProviderName) || "gemini";

    // Pick model: user-selected → provider default → explicit arg → env var
    // userSettings.selectedModel always wins so Ollama/local users get the
    // right model name even when the caller passes a Gemini model string.
    this.modelName =
      userSettings?.selectedModel ||
      DEFAULT_MODELS[primary] ||
      modelName ||
      process.env.AI_MODEL ||
      "gemini-2.5-flash-lite";

    // ------------------------------------------------------------------
    // Initialise providers
    // ------------------------------------------------------------------

    const geminiKey =
      userSettings?.apiKeys?.gemini || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      // Always use a valid Gemini model name (never an Ollama/local model name).
      const geminiModelName =
        (primary === "gemini" ? userSettings?.selectedModel : undefined) ||
        modelName ||
        process.env.AI_MODEL ||
        "gemini-2.5-flash-lite";
      this.geminiModel = new ChatGoogleGenerativeAI({
        model: geminiModelName,
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

    const anthropicKey =
      userSettings?.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
    }

    // Determine OpenAI-compatible client: prefer whichever matches primary
    if (primary === "openrouter") {
      const key =
        userSettings?.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
      if (key) {
        this.openaiClient = new OpenAI({
          apiKey: key,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "",
          },
        });
        this.openaiProviderName = "openrouter";
      }
    } else if (
      primary === "openai" ||
      ![
        "gemini",
        "anthropic",
        "groq",
        "openrouter",
        "ollama",
        "lmstudio",
        "vllm",
        "custom",
      ].includes(primary)
    ) {
      const key = userSettings?.apiKeys?.openai || process.env.OPENAI_API_KEY;
      if (key) {
        this.openaiClient = new OpenAI({ apiKey: key });
        this.openaiProviderName = "openai";
      }
    } else if (primary === "ollama") {
      // Ollama uses native fetch directly — the OpenAI SDK causes 405 errors
      // when running inside Next.js webpack bundled routes.
      const endpoint = this.resolveLocalEndpoint("ollama", userSettings);
      if (endpoint) {
        this.ollamaBaseURL = endpoint.replace(/\/v1\/?$/, "");
      }
    } else if (primary === "lmstudio" || primary === "vllm") {
      const endpoint = this.resolveLocalEndpoint(primary, userSettings);
      if (endpoint) {
        this.openaiClient = new OpenAI({
          apiKey: "local",
          baseURL: endpoint.endsWith("/v1") ? endpoint : `${endpoint}/v1`,
        });
        this.openaiProviderName = primary;
      }
    } else if (
      primary === "custom" &&
      userSettings?.apiKeys?.custom?.endpoint
    ) {
      this.openaiClient = new OpenAI({
        apiKey: userSettings.apiKeys.custom.apiKey || "custom",
        baseURL: userSettings.apiKeys.custom.endpoint,
      });
      this.openaiProviderName = "custom";
    }

    // Always also try to set up non-primary OpenAI/OpenRouter for fallback
    if (!this.openaiClient || this.openaiProviderName !== "openai") {
      const key = userSettings?.apiKeys?.openai || process.env.OPENAI_API_KEY;
      if (key) {
        // Store as secondary — we'll use it in fallback by switching provider
        // For simplicity keep one openai client (prefer primary)
        if (!this.openaiClient) {
          this.openaiClient = new OpenAI({ apiKey: key });
          this.openaiProviderName = "openai";
        }
      }
    }
    if (!this.openaiClient || this.openaiProviderName !== "openrouter") {
      const key =
        userSettings?.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
      if (key && !this.openaiClient) {
        this.openaiClient = new OpenAI({
          apiKey: key,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "",
          },
        });
        this.openaiProviderName = "openrouter";
      }
    }

    const groqKey = userSettings?.apiKeys?.groq || process.env.GROQ_API_KEY;
    if (groqKey) {
      this.groqClient = new Groq({ apiKey: groqKey });
    }

    // ------------------------------------------------------------------
    // Resolve primary with auto-downgrade
    // ------------------------------------------------------------------

    let preferred = primary;
    if (!this.isAvailable(preferred)) {
      const order: ProviderName[] = [
        "gemini",
        "anthropic",
        "openai",
        "groq",
        "openrouter",
        "ollama",
        "lmstudio",
        "vllm",
      ];
      const available = order.find((p) => this.isAvailable(p));
      if (!available) {
        console.warn(
          "[AIClient] No AI provider keys configured — LLM calls will fail gracefully.",
        );
        this.noProvidersAvailable = true;
        this.primaryProvider = "gemini";
        this.fallbackOrder = [];
        return;
      }
      console.warn(
        `[AIClient] Primary "${preferred}" has no key — using "${available}" instead.`,
      );
      preferred = available;
    }

    this.primaryProvider = preferred;

    // ------------------------------------------------------------------
    // Build fallback chain
    // ------------------------------------------------------------------
    this.fallbackOrder = [];
    const fallbackEnabled = userSettings?.fallbackEnabled !== false;

    if (fallbackEnabled) {
      const preferredFallback = userSettings?.fallbackProvider as
        | ProviderName
        | undefined;

      const candidates: ProviderName[] = [
        "gemini",
        "anthropic",
        "openai",
        "groq",
        "openrouter",
      ];

      if (preferredFallback) {
        if (
          preferredFallback !== this.primaryProvider &&
          this.isAvailable(preferredFallback)
        ) {
          this.fallbackOrder.push(preferredFallback);
        } else if (preferredFallback !== this.primaryProvider) {
          console.warn(
            `[AIClient] Fallback "${preferredFallback}" has no key — skipping.`,
          );
        }
      } else {
        for (const p of candidates) {
          if (p !== this.primaryProvider && this.isAvailable(p)) {
            this.fallbackOrder.push(p);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveLocalEndpoint(
    provider: ProviderName,
    userSettings?: APISettings,
  ): string | undefined {
    const defaults: Partial<Record<ProviderName, string>> = {
      ollama: process.env.OLLAMA_HOST || "http://localhost:11434",
      lmstudio: "http://localhost:1234",
      vllm: "http://localhost:8000",
    };
    const userEndpoints = userSettings?.localEndpoints as
      | Record<string, string | undefined>
      | undefined;
    return userEndpoints?.[provider as string] || defaults[provider];
  }

  private isAvailable(provider: ProviderName): boolean {
    switch (provider) {
      case "gemini":
        return !!this.geminiModel;
      case "anthropic":
        return !!this.anthropicClient;
      case "openai":
        return !!this.openaiClient && this.openaiProviderName === "openai";
      case "openrouter":
        return !!this.openaiClient && this.openaiProviderName === "openrouter";
      case "groq":
        return !!this.groqClient;
      case "ollama":
        return !!this.ollamaBaseURL;
      case "lmstudio":
      case "vllm":
      case "custom":
        return !!this.openaiClient && this.openaiProviderName === provider;
      default:
        return false;
    }
  }

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

  private toSimpleMessages(
    messages: BaseMessage[],
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    return messages.map((msg) => {
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
  }

  // ---------------------------------------------------------------------------
  // Public: invoke (non-streaming)
  // ---------------------------------------------------------------------------

  async invoke(messages: BaseMessage[]): Promise<{ content: string }> {
    if (this.noProvidersAvailable) {
      throw new Error(
        "No AI provider keys configured. Please add at least one API key in Settings.",
      );
    }

    try {
      return await this.invokeProvider(this.primaryProvider, messages);
    } catch (error) {
      console.error(`[AIClient] ${this.primaryProvider} invoke failed:`, error);
    }

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

  // ---------------------------------------------------------------------------
  // Public: stream (async generator, yields string chunks)
  // ---------------------------------------------------------------------------

  async *stream(
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    if (this.noProvidersAvailable) {
      throw new Error(
        "No AI provider keys configured. Please add at least one API key in Settings.",
      );
    }

    let hasYieldedData = false;

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
      if (hasYieldedData) throw error;
    }

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

  // ---------------------------------------------------------------------------
  // Private: invoke routing
  // ---------------------------------------------------------------------------

  private async invokeProvider(
    provider: ProviderName,
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    switch (provider) {
      case "gemini":
        return this.normalizeResponse(await this.geminiModel!.invoke(messages));
      case "anthropic":
        return await this.invokeAnthropic(messages);
      case "openai":
      case "openrouter":
      case "ollama":
        return await this.invokeLocalFetch(messages);
      case "lmstudio":
      case "vllm":
      case "custom":
        return await this.invokeOpenAICompatible(provider, messages);
      case "groq":
        return await this.invokeGroq(messages);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: stream routing
  // ---------------------------------------------------------------------------

  private async *streamProvider(
    provider: ProviderName,
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    switch (provider) {
      case "gemini": {
        const geminiStream = this.geminiModel!.stream(messages);
        for await (const chunk of await geminiStream) {
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
      case "anthropic":
        yield* this.streamAnthropic(messages);
        break;
      case "openai":
      case "openrouter":
        yield* this.streamOpenAICompatible(messages);
        break;
      case "ollama":
        yield* this.streamLocalFetch(messages);
        break;
      case "lmstudio":
      case "vllm":
      case "custom":
        yield* this.streamOpenAICompatible(messages);
        break;
      case "groq": {
        const groqMsgs = this.toSimpleMessages(messages);
        const model =
          this.resolveModelForProvider("groq") || "llama-3.3-70b-versatile";
        const groqStream = await this.groqClient!.chat.completions.create({
          messages: groqMsgs,
          model,
          temperature: this.temperature,
          max_tokens: 4096,
          stream: true,
        });
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) yield text;
        }
        break;
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Anthropic
  // ---------------------------------------------------------------------------

  private async invokeAnthropic(
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    const simple = this.toSimpleMessages(messages);
    const systemMsg = simple.find((m) => m.role === "system");
    const nonSystem = simple.filter((m) => m.role !== "system");
    const model =
      this.resolveModelForProvider("anthropic") || "claude-3-5-haiku-20241022";

    const response = await this.anthropicClient!.messages.create({
      model,
      max_tokens: 8096,
      temperature: this.temperature,
      ...(systemMsg && { system: systemMsg.content }),
      messages: nonSystem as Anthropic.MessageParam[],
    });

    const content = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("");
    return { content };
  }

  private async *streamAnthropic(
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const simple = this.toSimpleMessages(messages);
    const systemMsg = simple.find((m) => m.role === "system");
    const nonSystem = simple.filter((m) => m.role !== "system");
    const model =
      this.resolveModelForProvider("anthropic") || "claude-3-5-haiku-20241022";

    const stream = this.anthropicClient!.messages.stream({
      model,
      max_tokens: 8096,
      temperature: this.temperature,
      ...(systemMsg && { system: systemMsg.content }),
      messages: nonSystem as Anthropic.MessageParam[],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private: provider-aware model name resolver
  // ---------------------------------------------------------------------------

  /**
   * Returns the right model name for `provider`.
   * When acting as a fallback (primary !== provider), the provider’s own default
   * is preferred so we never send e.g. an Ollama model name to Anthropic.
   */
  private resolveModelForProvider(provider: ProviderName): string {
    if (this.primaryProvider === provider) {
      // We ARE the primary provider – this.modelName was chosen for it.
      return this.modelName || DEFAULT_MODELS[provider] || "";
    }
    // Fallback path: prefer the provider’s own default over a possibly
    // mismatched model name (e.g. "qwen2.5:3b" sent to Anthropic).
    return DEFAULT_MODELS[provider] || this.modelName || "";
  }

  // ---------------------------------------------------------------------------
  // Private: Ollama via native fetch (avoids OpenAI SDK / Next.js webpack issue)
  // ---------------------------------------------------------------------------

  private async invokeLocalFetch(
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    const base = this.ollamaBaseURL!;
    const model = this.resolveModelForProvider("ollama") || "llama3";
    const simple = this.toSimpleMessages(messages);

    // Try OpenAI-compatible endpoint first (Ollama 0.1.28+)
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: simple,
        temperature: this.temperature,
        max_tokens: 4096,
        stream: false,
        ...(this.jsonMode && { response_format: { type: "json_object" } }),
      }),
    });

    // 405 = older Ollama that doesn't support /v1/chat/completions — fall back
    // to the native /api/chat endpoint.
    if (res.status === 405) {
      console.warn(
        "[AIClient] Ollama /v1/chat/completions returned 405, retrying with native /api/chat",
      );
      const nativeRes = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: simple,
          stream: false,
          options: { temperature: this.temperature },
        }),
      });
      if (!nativeRes.ok) {
        throw new Error(
          `Ollama native fetch ${nativeRes.status} ${nativeRes.statusText}`,
        );
      }
      const nativeData = await nativeRes.json();
      return { content: nativeData.message?.content || "" };
    }

    if (!res.ok) {
      throw new Error(`Ollama fetch ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || "" };
  }

  private async *streamLocalFetch(
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const base = this.ollamaBaseURL!;
    const model = this.resolveModelForProvider("ollama") || "llama3";
    const simple = this.toSimpleMessages(messages);

    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: simple,
        temperature: this.temperature,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama stream ${res.status} ${res.statusText}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload);
          const text = chunk.choices?.[0]?.delta?.content || "";
          if (text) yield text;
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private: OpenAI-compatible (OpenAI, OpenRouter, LM Studio, vLLM)
  // ---------------------------------------------------------------------------

  private resolveOpenAIModel(provider: ProviderName): string {
    return this.resolveModelForProvider(provider) || "gpt-4o-mini";
  }

  private async invokeOpenAICompatible(
    provider: ProviderName,
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    const simple = this.toSimpleMessages(messages);
    const model = this.resolveOpenAIModel(provider);

    const completion = await this.openaiClient!.chat.completions.create({
      model,
      messages: simple,
      temperature: this.temperature,
      max_tokens: 4096,
      ...(this.jsonMode && { response_format: { type: "json_object" } }),
    });

    return { content: completion.choices[0]?.message?.content || "" };
  }

  private async *streamOpenAICompatible(
    messages: BaseMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const simple = this.toSimpleMessages(messages);
    const model = this.resolveOpenAIModel(this.primaryProvider);

    const stream = await this.openaiClient!.chat.completions.create({
      model,
      messages: simple,
      temperature: this.temperature,
      max_tokens: 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) yield text;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Groq
  // ---------------------------------------------------------------------------

  private async invokeGroq(
    messages: BaseMessage[],
  ): Promise<{ content: string }> {
    const simple = this.toSimpleMessages(messages);
    const model =
      this.resolveModelForProvider("groq") || "llama-3.3-70b-versatile";

    const completion = await this.groqClient!.chat.completions.create({
      messages: simple,
      model,
      temperature: this.temperature,
      max_tokens: 4096,
      ...(this.jsonMode && { response_format: { type: "json_object" } }),
    });

    return { content: completion.choices[0]?.message?.content || "" };
  }

  // ---------------------------------------------------------------------------
  // Public: accessors
  // ---------------------------------------------------------------------------

  getPrimaryProvider(): ProviderName {
    return this.primaryProvider;
  }

  /** Legacy accessor for callers that need the underlying Gemini LangChain model */
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
