/**
 * Provider type definitions for the unified AI provider architecture.
 * All provider-specific logic must live inside a provider adapter;
 * the rest of the application interacts only through these interfaces.
 */

export type CloudProvider =
  | "gemini"
  | "openai"
  | "anthropic"
  | "groq"
  | "openrouter";

export type LocalProvider = "ollama" | "lmstudio" | "vllm";

export type ProviderName = CloudProvider | LocalProvider | "custom";

export type ModelSource = "cloud" | "local";

// ---------------------------------------------------------------------------
// Model info
// ---------------------------------------------------------------------------

export interface ModelCapabilities {
  chat: boolean;
  reasoning?: boolean;
  vision?: boolean;
  embeddings?: boolean;
  code?: boolean;
  functionCalling?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  contextWindow?: number;
  /** USD per 1M input tokens */
  inputCostPer1M?: number;
  /** USD per 1M output tokens */
  outputCostPer1M?: number;
  capabilities?: ModelCapabilities;
  /** True when the API key does not have access to this model */
  isRestricted?: boolean;
  restrictionMessage?: string;
  /** For local models: running / stopped / loading */
  status?: string;
}

// ---------------------------------------------------------------------------
// Provider metadata (static registry)
// ---------------------------------------------------------------------------

export interface ProviderMeta {
  name: ProviderName;
  displayName: string;
  isLocal: boolean;
  apiKeyRequired: boolean;
  apiKeyPlaceholder?: string;
  apiKeyLink?: string;
  apiKeyLinkLabel?: string;
  endpointRequired?: boolean;
  defaultEndpoint?: string;
  description: string;
}

export const PROVIDER_REGISTRY: Record<ProviderName, ProviderMeta> = {
  gemini: {
    name: "gemini",
    displayName: "Google Gemini",
    isLocal: false,
    apiKeyRequired: true,
    apiKeyPlaceholder: "AIzaSy...",
    apiKeyLink: "https://makersuite.google.com/app/apikey",
    apiKeyLinkLabel: "Google AI Studio",
    description: "Gemini 2.0, 2.5 Flash, Ultra and more",
  },
  openai: {
    name: "openai",
    displayName: "OpenAI",
    isLocal: false,
    apiKeyRequired: true,
    apiKeyPlaceholder: "sk-...",
    apiKeyLink: "https://platform.openai.com/api-keys",
    apiKeyLinkLabel: "OpenAI Platform",
    description: "GPT-4o, o1, o3 and more",
  },
  anthropic: {
    name: "anthropic",
    displayName: "Anthropic (Claude)",
    isLocal: false,
    apiKeyRequired: true,
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyLink: "https://console.anthropic.com/settings/keys",
    apiKeyLinkLabel: "Anthropic Console",
    description: "Claude 3.5 Sonnet, Haiku, and more",
  },
  groq: {
    name: "groq",
    displayName: "Groq",
    isLocal: false,
    apiKeyRequired: true,
    apiKeyPlaceholder: "gsk_...",
    apiKeyLink: "https://console.groq.com/keys",
    apiKeyLinkLabel: "Groq Console",
    description: "Ultra-fast inference for Llama, Mixtral models",
  },
  openrouter: {
    name: "openrouter",
    displayName: "OpenRouter",
    isLocal: false,
    apiKeyRequired: true,
    apiKeyPlaceholder: "sk-or-...",
    apiKeyLink: "https://openrouter.ai/keys",
    apiKeyLinkLabel: "OpenRouter",
    description: "Access 100+ models from a single API",
  },
  ollama: {
    name: "ollama",
    displayName: "Ollama",
    isLocal: true,
    apiKeyRequired: false,
    endpointRequired: true,
    defaultEndpoint: "http://localhost:11434",
    description: "Run models locally with Ollama",
  },
  lmstudio: {
    name: "lmstudio",
    displayName: "LM Studio",
    isLocal: true,
    apiKeyRequired: false,
    endpointRequired: true,
    defaultEndpoint: "http://localhost:1234",
    description: "Run models locally with LM Studio",
  },
  vllm: {
    name: "vllm",
    displayName: "vLLM",
    isLocal: true,
    apiKeyRequired: false,
    endpointRequired: true,
    defaultEndpoint: "http://localhost:8000",
    description: "High-throughput local inference with vLLM",
  },
  custom: {
    name: "custom",
    displayName: "Custom Endpoint",
    isLocal: false,
    apiKeyRequired: false,
    endpointRequired: true,
    description: "Any OpenAI-compatible API endpoint",
  },
};

export const CLOUD_PROVIDERS: CloudProvider[] = [
  "gemini",
  "openai",
  "anthropic",
  "groq",
  "openrouter",
];

export const LOCAL_PROVIDERS: LocalProvider[] = ["ollama", "lmstudio", "vllm"];

// ---------------------------------------------------------------------------
// Static model lists for providers without dynamic model APIs
// ---------------------------------------------------------------------------

export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    capabilities: {
      chat: true,
      reasoning: true,
      vision: true,
      code: true,
      functionCalling: true,
    },
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    capabilities: {
      chat: true,
      reasoning: true,
      vision: true,
      code: true,
      functionCalling: true,
    },
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    capabilities: {
      chat: true,
      reasoning: true,
      vision: true,
      code: true,
      functionCalling: true,
    },
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4,
    capabilities: {
      chat: true,
      reasoning: true,
      vision: true,
      code: true,
      functionCalling: true,
    },
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    capabilities: {
      chat: true,
      vision: true,
      code: true,
      functionCalling: true,
    },
  },
];

/** Default model IDs to use when the user has not selected a specific model */
export const DEFAULT_MODELS: Partial<Record<ProviderName, string>> = {
  gemini: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
  ollama: process.env.OLLAMA_MODEL || "qwen2.5:3b",
  lmstudio: "loaded-model",
  vllm: "loaded-model",
};
