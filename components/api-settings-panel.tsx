"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  BadgeCheck,
  Server,
} from "lucide-react";
import {
  PROVIDER_REGISTRY,
  CLOUD_PROVIDERS,
  LOCAL_PROVIDERS,
} from "@/lib/providers/types";
import type {
  CloudProvider,
  LocalProvider,
  ProviderName,
} from "@/lib/providers/types";

type CloudProviderKey = CloudProvider;

interface ProviderSettings {
  primaryProvider: ProviderName;
  fallbackEnabled: boolean;
  fallbackProvider?: ProviderName;
  modelSource?: "cloud" | "local";
}

interface APISettingsResponse extends ProviderSettings {
  hasKeys: Record<CloudProviderKey, boolean>;
  localEndpoints?: Record<string, string>;
}

export function APISettingsPanel({ userId }: { userId: string }) {
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    primaryProvider: "gemini",
    fallbackEnabled: true,
    fallbackProvider: "anthropic",
    modelSource: "cloud",
  });

  const [hasKeys, setHasKeys] = useState<Record<CloudProviderKey, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    groq: false,
    openrouter: false,
  });

  const [keyInputs, setKeyInputs] = useState<Record<CloudProviderKey, string>>({
    gemini: "",
    openai: "",
    anthropic: "",
    groq: "",
    openrouter: "",
  });

  const [showKeys, setShowKeys] = useState<Record<CloudProviderKey, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    groq: false,
    openrouter: false,
  });

  const [localEndpoints, setLocalEndpoints] = useState<
    Record<LocalProvider, string>
  >({
    ollama: "",
    lmstudio: "",
    vllm: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings/api-keys", {
        headers: { "x-user-id": userId },
      });
      if (response.ok) {
        const data: APISettingsResponse = await response.json();
        setProviderSettings({
          primaryProvider: data.primaryProvider,
          fallbackEnabled: data.fallbackEnabled,
          fallbackProvider: data.fallbackProvider,
          modelSource: data.modelSource,
        });
        setHasKeys({
          gemini: data.hasKeys?.gemini ?? false,
          openai: data.hasKeys?.openai ?? false,
          anthropic: data.hasKeys?.anthropic ?? false,
          groq: data.hasKeys?.groq ?? false,
          openrouter: data.hasKeys?.openrouter ?? false,
        });
        setKeyInputs({
          gemini: "",
          openai: "",
          anthropic: "",
          groq: "",
          openrouter: "",
        });
        if (data.localEndpoints) {
          setLocalEndpoints({
            ollama: data.localEndpoints.ollama || "",
            lmstudio: data.localEndpoints.lmstudio || "",
            vllm: data.localEndpoints.vllm || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const apiKeys: Partial<Record<CloudProviderKey, string>> = {};
    (Object.keys(keyInputs) as CloudProviderKey[]).forEach((p) => {
      if (keyInputs[p].trim()) apiKeys[p] = keyInputs[p].trim();
    });

    const filteredEndpoints: Record<string, string> = {};
    (Object.keys(localEndpoints) as LocalProvider[]).forEach((p) => {
      if (localEndpoints[p].trim())
        filteredEndpoints[p] = localEndpoints[p].trim();
    });

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          ...providerSettings,
          apiKeys,
          localEndpoints: filteredEndpoints,
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "API settings saved successfully!",
        });
        await fetchSettings();
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error("Failed to save settings");
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground mb-5">
          Configure your AI provider. Keys are stored securely and never
          returned to the client.
        </p>

        {/* Model Source Toggle */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
          <div>
            <h3 className="font-medium text-foreground">Model Source</h3>
            <p className="text-sm text-muted-foreground">
              Use cloud APIs or locally-running models
            </p>
          </div>
          <div className="flex gap-2">
            {(["cloud", "local"] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() =>
                  setProviderSettings({ ...providerSettings, modelSource: src })
                }
                className={`px-4 py-1.5 rounded-md border-2 text-sm font-medium transition-all capitalize  cursor-pointer ${
                  (providerSettings.modelSource || "cloud") === src
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}>
                {src === "local" ? (
                  <span className="flex items-center gap-1 ">
                    <Server className="w-3 h-3" /> Local
                  </span>
                ) : (
                  "Cloud"
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── CLOUD PROVIDERS ── */}
        {(providerSettings.modelSource || "cloud") === "cloud" && (
          <>
            {/* Primary Provider */}
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium text-foreground">
                Primary AI Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 ">
                {CLOUD_PROVIDERS.map((p) => {
                  const meta = PROVIDER_REGISTRY[p];
                  return (
                    <div
                      key={p}
                      className="flex flex-col items-center gap-1.5 ">
                      <button
                        type="button"
                        onClick={() =>
                          setProviderSettings({
                            ...providerSettings,
                            primaryProvider: p,
                          })
                        }
                        className={`w-full p-3 rounded-md border-2 transition-all  cursor-pointer ${
                          providerSettings.primaryProvider === p
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}>
                        <div className="font-medium text-sm truncate">
                          {meta.displayName}
                        </div>
                      </button>
                      {hasKeys[p as CloudProviderKey] && (
                        <div className="text-xs text-success flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> Key set
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Key Inputs */}
            <div className="space-y-5">
              {CLOUD_PROVIDERS.map((provider) => {
                const meta = PROVIDER_REGISTRY[provider];
                return (
                  <div key={provider} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-foreground">
                        {meta.displayName} API Key
                      </label>
                      {hasKeys[provider as CloudProviderKey] && (
                        <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <BadgeCheck className="w-3 h-3" /> Saved
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={
                          showKeys[provider as CloudProviderKey]
                            ? "text"
                            : "password"
                        }
                        value={keyInputs[provider as CloudProviderKey]}
                        onChange={(e) =>
                          setKeyInputs({
                            ...keyInputs,
                            [provider]: e.target.value,
                          })
                        }
                        placeholder={
                          hasKeys[provider as CloudProviderKey]
                            ? "Leave blank to keep existing key"
                            : meta.apiKeyPlaceholder || "API Key"
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowKeys({
                            ...showKeys,
                            [provider]: !showKeys[provider as CloudProviderKey],
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKeys[provider as CloudProviderKey] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {meta.apiKeyLink && (
                      <p className="text-xs text-muted-foreground">
                        Get your key from{" "}
                        <a
                          href={meta.apiKeyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline">
                          {meta.apiKeyLinkLabel}
                        </a>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fallback */}
            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <div className="flex flex-wrap items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">
                    Enable Fallback
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Auto-switch to backup provider if primary fails
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setProviderSettings({
                      ...providerSettings,
                      fallbackEnabled: !providerSettings.fallbackEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors  cursor-pointer ${
                    providerSettings.fallbackEnabled
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      providerSettings.fallbackEnabled
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {providerSettings.fallbackEnabled && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Fallback Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {CLOUD_PROVIDERS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setProviderSettings({
                            ...providerSettings,
                            fallbackProvider: p,
                          })
                        }
                        className={`p-2 rounded-lg border-2 transition-all ${
                          providerSettings.fallbackProvider === p
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}>
                        <div className="text-xs font-medium">
                          {PROVIDER_REGISTRY[p].displayName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── LOCAL PROVIDERS ── */}
        {providerSettings.modelSource === "local" && (
          <>
            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium text-foreground">
                Local Provider
              </label>
              <div className="grid grid-cols-3 gap-3  ">
                {LOCAL_PROVIDERS.map((p) => {
                  const meta = PROVIDER_REGISTRY[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setProviderSettings({
                          ...providerSettings,
                          primaryProvider: p,
                        })
                      }
                      className={`p-3 rounded-md border-2 transition-all text-left  cursor-pointer ${
                        providerSettings.primaryProvider === p
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}>
                      <div className="font-medium text-sm">
                        {meta.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {meta.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Local endpoint configuration */}
            <div className="space-y-5">
              {LOCAL_PROVIDERS.map((provider) => {
                const meta = PROVIDER_REGISTRY[provider];
                return (
                  <div key={provider} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {meta.displayName} Endpoint
                    </label>
                    <Input
                      value={localEndpoints[provider]}
                      onChange={(e) =>
                        setLocalEndpoints({
                          ...localEndpoints,
                          [provider]: e.target.value,
                        })
                      }
                      placeholder={
                        meta.defaultEndpoint || "http://localhost:..."
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Default: {meta.defaultEndpoint}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Save */}
        <div className="mt-6 pt-6 border-t border-border">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}>
              {message.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-primary/10 border-primary/30">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-primary">
            <p className="font-medium mb-1">Security Note</p>
            <p>
              API keys are encrypted and stored in the database. They are never
              returned to the client after saving. Leave a field blank to keep
              an existing key.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
