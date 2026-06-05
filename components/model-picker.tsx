"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check,
  ChevronDown,
  RefreshCw,
  Server,
  Cloud,
  Lock,
} from "lucide-react";
import {
  PROVIDER_REGISTRY,
  CLOUD_PROVIDERS,
  LOCAL_PROVIDERS,
  DEFAULT_MODELS,
} from "@/lib/providers/types";
import type {
  ModelInfo,
  ProviderName,
  ModelSource,
} from "@/lib/providers/types";

interface ModelPickerProps {
  userId?: string;
  /** Currently selected provider */
  selectedProvider?: ProviderName;
  /** Currently selected model ID */
  selectedModel?: string;
  /** Whether to use cloud or local models */
  modelSource?: ModelSource;
  /** Called when the user picks a different provider */
  onProviderChange?: (provider: ProviderName) => void;
  /** Called when the user picks a different model */
  onModelChange?: (modelId: string) => void;
  /** Called when the model source changes */
  onSourceChange?: (source: ModelSource) => void;
  className?: string;
}

/**
 * Unified model picker component.
 *
 * Shows a provider selector, a model selector populated via `/api/models`,
 * and metadata about the selected model (context window, pricing, capabilities).
 * Works for both cloud and local providers.
 */
export function ModelPicker({
  userId,
  selectedProvider = "gemini",
  selectedModel,
  modelSource = "cloud",
  onProviderChange,
  onModelChange,
  onSourceChange,
  className = "",
}: ModelPickerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const providers = modelSource === "local" ? LOCAL_PROVIDERS : CLOUD_PROVIDERS;

  const activeModelId = selectedModel || DEFAULT_MODELS[selectedProvider] || "";
  const activeModel = models.find((m) => m.id === activeModelId) ?? null;
  const providerMeta = PROVIDER_REGISTRY[selectedProvider];

  // Load models when provider changes
  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setModels([]);
    try {
      const headers: Record<string, string> = {};
      if (userId) headers["x-user-id"] = userId;
      const res = await fetch(`/api/models?provider=${selectedProvider}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setModels(data.models ?? []);
      }
    } catch {
      // silent — no models available
    } finally {
      setLoadingModels(false);
    }
  }, [selectedProvider, userId]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleProviderSelect = (p: ProviderName) => {
    setProviderOpen(false);
    onProviderChange?.(p);
  };

  const handleModelSelect = (id: string) => {
    setModelOpen(false);
    onModelChange?.(id);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Source toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["cloud", "local"] as ModelSource[]).map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => onSourceChange?.(src)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-all ${
              modelSource === src
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {src === "local" ? (
              <Server className="w-3.5 h-3.5" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            {src === "cloud" ? "Cloud" : "Local"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {/* Provider selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProviderOpen(!providerOpen);
              setModelOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium transition-colors min-w-32">
            ,
            <span className="truncate">
              {providerMeta?.displayName ?? selectedProvider}
            </span>
            <ChevronDown className="w-3.5 h-3.5 ml-auto shrink-0 text-muted-foreground" />
          </button>

          {providerOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 w-52 rounded-md border border-border bg-popover shadow-lg py-1">
              {providers.map((p) => {
                const meta = PROVIDER_REGISTRY[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderSelect(p)}
                    className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted text-sm text-left">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {meta.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {meta.description}
                      </div>
                    </div>
                    {selectedProvider === p && (
                      <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Model selector */}
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => {
              setModelOpen(!modelOpen);
              setProviderOpen(false);
            }}
            disabled={loadingModels}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-sm transition-colors">
            {loadingModels ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : null}
            <span className="truncate flex-1 text-left">
              {activeModelId || "Select model…"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          </button>

          {modelOpen && models.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModelSelect(m.id)}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted text-sm text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{m.name}</span>
                      {m.isRestricted && (
                        <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {m.contextWindow && (
                        <span>{(m.contextWindow / 1000).toFixed(0)}K ctx</span>
                      )}
                      {m.inputCostPer1M !== undefined && (
                        <span>${m.inputCostPer1M.toFixed(2)}/1M in</span>
                      )}
                      {m.capabilities?.vision && (
                        <span className="bg-blue-500/10 text-blue-500 px-1 rounded">
                          vision
                        </span>
                      )}
                      {m.capabilities?.reasoning && (
                        <span className="bg-purple-500/10 text-purple-500 px-1 rounded">
                          reasoning
                        </span>
                      )}
                      {m.status && (
                        <span className="bg-green-500/10 text-green-600 px-1 rounded">
                          {m.status}
                        </span>
                      )}
                    </div>
                    {m.isRestricted && m.restrictionMessage && (
                      <p className="text-xs text-amber-500 mt-0.5">
                        {m.restrictionMessage}
                      </p>
                    )}
                  </div>
                  {activeModelId === m.id && (
                    <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {modelOpen && !loadingModels && models.length === 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-lg p-3">
              <p className="text-sm text-muted-foreground text-center">
                {providerMeta?.isLocal
                  ? "No models detected. Is the server running?"
                  : "No models found. Check your API key."}
              </p>
              <button
                type="button"
                onClick={loadModels}
                className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={loadModels}
          disabled={loadingModels}
          className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
          title="Refresh models">
          <RefreshCw
            className={`w-4 h-4 text-muted-foreground ${loadingModels ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Selected model metadata */}
      {activeModel && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-3 px-1">
          {activeModel.contextWindow && (
            <span>
              Context:{" "}
              <span className="font-medium text-foreground">
                {(activeModel.contextWindow / 1000).toFixed(0)}K tokens
              </span>
            </span>
          )}
          {activeModel.inputCostPer1M !== undefined && (
            <span>
              Cost:{" "}
              <span className="font-medium text-foreground">
                ${activeModel.inputCostPer1M.toFixed(2)} / $
                {activeModel.outputCostPer1M?.toFixed(2)} per 1M tokens
              </span>
            </span>
          )}
          {activeModel.capabilities && (
            <span className="flex gap-1 flex-wrap">
              {Object.entries(activeModel.capabilities)
                .filter(([, v]) => v)
                .map(([cap]) => (
                  <span
                    key={cap}
                    className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                    {cap}
                  </span>
                ))}
            </span>
          )}
          {providerMeta?.isLocal && (
            <span className="flex items-center gap-1 text-green-600">
              <Server className="w-3 h-3" /> Local
            </span>
          )}
        </div>
      )}

      {/* Close dropdowns on outside click */}
      {(providerOpen || modelOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setProviderOpen(false);
            setModelOpen(false);
          }}
        />
      )}
    </div>
  );
}
