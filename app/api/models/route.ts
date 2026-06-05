/**
 * GET /api/models?provider=<name>
 *
 * Dynamically fetches available models for a given provider using the
 * authenticated user's API key (or the environment fallback).
 *
 * Returns ModelInfo[] — provider-specific metadata is normalised to a
 * common shape. Restricted / unavailable models are included but flagged.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import UserModel from "@/lib/models/User";
import {
  ANTHROPIC_MODELS,
  DEFAULT_MODELS,
  PROVIDER_REGISTRY,
} from "@/lib/providers/types";
import type { ModelInfo, ProviderName } from "@/lib/providers/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserSettings(userId: string | null) {
  if (!userId) return null;
  try {
    await connectDB();
    const user = await UserModel.findById(userId, { apiSettings: 1 }).lean();
    return (user as any)?.apiSettings ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider-specific model fetchers
// ---------------------------------------------------------------------------

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models: ModelInfo[] = (data.models ?? [])
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: any) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name,
        provider: "gemini" as ProviderName,
        contextWindow: m.inputTokenLimit,
        capabilities: {
          chat: true,
          vision: m.supportedGenerationMethods?.includes("generateContent"),
          code: true,
          functionCalling: true,
        },
      }));
    return models;
  } catch {
    return [];
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const chatModels = (data.data ?? []).filter(
      (m: any) =>
        m.id.startsWith("gpt-") ||
        m.id.startsWith("o1") ||
        m.id.startsWith("o3") ||
        m.id.startsWith("chatgpt-"),
    );
    return chatModels.map((m: any) => ({
      id: m.id,
      name: m.id,
      provider: "openai" as ProviderName,
      capabilities: { chat: true, code: true, functionCalling: true },
    }));
  } catch {
    return [];
  }
}

// Anthropic doesn't have a dynamic models endpoint — return static list
function fetchAnthropicModels(): ModelInfo[] {
  return ANTHROPIC_MODELS;
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((m: any) => ({
      id: m.id,
      name: m.id,
      provider: "groq" as ProviderName,
      contextWindow: m.context_window,
      capabilities: { chat: true, code: true },
    }));
  } catch {
    return [];
  }
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: "openrouter" as ProviderName,
      contextWindow: m.context_length,
      inputCostPer1M: m.pricing?.prompt
        ? parseFloat(m.pricing.prompt) * 1_000_000
        : undefined,
      outputCostPer1M: m.pricing?.completion
        ? parseFloat(m.pricing.completion) * 1_000_000
        : undefined,
      capabilities: {
        chat: true,
        vision: !!m.architecture?.modality?.includes("image"),
        code: true,
        functionCalling: !!(m.top_provider?.is_moderated === false || m.id),
      },
    }));
  } catch {
    return [];
  }
}

async function fetchOllamaModels(endpoint: string): Promise<ModelInfo[]> {
  const base = endpoint.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: "ollama" as ProviderName,
      contextWindow: m.details?.parameter_size ? undefined : undefined,
      status: "running",
      capabilities: { chat: true, code: true },
    }));
  } catch {
    return [];
  }
}

async function fetchOpenAICompatibleModels(
  endpoint: string,
  apiKey: string,
  provider: ProviderName,
): Promise<ModelInfo[]> {
  const base = endpoint.replace(/\/$/, "").replace(/\/v1$/, "");
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey || "local"}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((m: any) => ({
      id: m.id,
      name: m.id,
      provider,
      capabilities: { chat: true, code: true },
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as ProviderName | null;
  const userId = request.headers.get("x-user-id");

  if (!provider || !PROVIDER_REGISTRY[provider]) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const userSettings = await getUserSettings(userId);

  let models: ModelInfo[] = [];

  try {
    switch (provider) {
      case "gemini": {
        const key = userSettings?.apiKeys?.gemini || process.env.GOOGLE_API_KEY;
        if (key) models = await fetchGeminiModels(key);
        break;
      }
      case "openai": {
        const key = userSettings?.apiKeys?.openai || process.env.OPENAI_API_KEY;
        if (key) models = await fetchOpenAIModels(key);
        break;
      }
      case "anthropic": {
        // Anthropic has no public model listing endpoint
        models = fetchAnthropicModels();
        break;
      }
      case "groq": {
        const key = userSettings?.apiKeys?.groq || process.env.GROQ_API_KEY;
        if (key) models = await fetchGroqModels(key);
        break;
      }
      case "openrouter": {
        const key =
          userSettings?.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
        if (key) models = await fetchOpenRouterModels(key);
        break;
      }
      case "ollama": {
        const endpoint =
          userSettings?.localEndpoints?.ollama ||
          process.env.OLLAMA_HOST ||
          "http://localhost:11434";
        models = await fetchOllamaModels(endpoint);
        break;
      }
      case "lmstudio": {
        const endpoint =
          userSettings?.localEndpoints?.lmstudio || "http://localhost:1234";
        models = await fetchOpenAICompatibleModels(
          endpoint,
          "lm-studio",
          "lmstudio",
        );
        break;
      }
      case "vllm": {
        const endpoint =
          userSettings?.localEndpoints?.vllm || "http://localhost:8000";
        const key = process.env.VLLM_API_KEY || "vllm";
        models = await fetchOpenAICompatibleModels(endpoint, key, "vllm");
        break;
      }
      default:
        return NextResponse.json(
          { error: "Provider not supported" },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error(`[/api/models] Failed to fetch models for ${provider}:`, err);
    // Return empty list rather than 500 — UI will show no models
  }

  // If we got nothing and have a default, surface it
  if (models.length === 0 && DEFAULT_MODELS[provider]) {
    models = [
      {
        id: DEFAULT_MODELS[provider]!,
        name: DEFAULT_MODELS[provider]!,
        provider,
        capabilities: { chat: true },
      },
    ];
  }

  return NextResponse.json({ provider, models });
}
