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
} from "lucide-react";

type Provider = "gemini" | "openai" | "euri" | "groq";

interface ProviderSettings {
  primaryProvider: Provider | "custom";
  fallbackEnabled: boolean;
  fallbackProvider?: Provider;
}

interface APISettingsResponse extends ProviderSettings {
  hasKeys: Record<Provider, boolean>;
}

const PROVIDER_META: Record<
  Provider,
  { label: string; placeholder: string; href: string; hrefLabel: string }
> = {
  gemini: {
    label: "Google Gemini API Key",
    placeholder: "AIzaSy...",
    href: "https://makersuite.google.com/app/apikey",
    hrefLabel: "Google AI Studio",
  },
  openai: {
    label: "OpenAI API Key",
    placeholder: "sk-...",
    href: "https://platform.openai.com/api-keys",
    hrefLabel: "OpenAI Platform",
  },
  euri: {
    label: "Euri API Key",
    placeholder: "euri-...",
    href: "https://euri.ai",
    hrefLabel: "Euri",
  },
  groq: {
    label: "Groq API Key",
    placeholder: "gsk_...",
    href: "https://console.groq.com/keys",
    hrefLabel: "Groq Console",
  },
};

export function APISettingsPanel({ userId }: { userId: string }) {
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    primaryProvider: "gemini",
    fallbackEnabled: true,
    fallbackProvider: "euri",
  });

  // Which providers have a key saved in the DB
  const [hasKeys, setHasKeys] = useState<Record<Provider, boolean>>({
    gemini: false,
    openai: false,
    euri: false,
    groq: false,
  });

  // Key inputs — always start empty; user types a new value to add/replace a key
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>({
    gemini: "",
    openai: "",
    euri: "",
    groq: "",
  });

  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({
    gemini: false,
    openai: false,
    euri: false,
    groq: false,
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
        });
        setHasKeys({
          gemini: data.hasKeys?.gemini ?? false,
          openai: data.hasKeys?.openai ?? false,
          euri: data.hasKeys?.euri ?? false,
          groq: data.hasKeys?.groq ?? false,
        });
        // Always keep inputs empty — never populate with masked values
        setKeyInputs({ gemini: "", openai: "", euri: "", groq: "" });
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

    // Only include keys the user has actually typed (non-empty values)
    const apiKeys: Partial<Record<Provider, string>> = {};
    (Object.keys(keyInputs) as Provider[]).forEach((p) => {
      if (keyInputs[p].trim()) apiKeys[p] = keyInputs[p].trim();
    });

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ ...providerSettings, apiKeys }),
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
        <div className="flex items-start gap-3 md:gap-4 mb-5 md:mb-6">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mt-1">
              Configure your AI service providers. Leave a key field blank to
              keep the existing key unchanged.
            </p>
          </div>
        </div>

        {/* Primary Provider */}
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-foreground">
            Primary AI Provider
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["gemini", "openai", "euri", "groq"] as Provider[]).map((p) => (
              <div key={p} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setProviderSettings({
                      ...providerSettings,
                      primaryProvider: p,
                    })
                  }
                  className={`w-full p-3 rounded-md border-2 transition-all ${
                    providerSettings.primaryProvider === p
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}>
                  <div className="font-medium capitalize">{p}</div>
                </button>
                {hasKeys[p] && (
                  <div className="text-xs text-success flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> Key set
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* API Key Inputs */}
        <div className="space-y-6">
          {(
            Object.entries(PROVIDER_META) as [
              Provider,
              (typeof PROVIDER_META)[Provider],
            ][]
          ).map(([provider, meta]) => (
            <div key={provider} className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">
                  {meta.label}
                </label>
                {hasKeys[provider] && (
                  <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                    <BadgeCheck className="w-3 h-3" /> Saved
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKeys[provider] ? "text" : "password"}
                  value={keyInputs[provider]}
                  onChange={(e) =>
                    setKeyInputs({ ...keyInputs, [provider]: e.target.value })
                  }
                  placeholder={
                    hasKeys[provider]
                      ? "Leave blank to keep existing key, or enter new key to replace"
                      : meta.placeholder
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowKeys({
                      ...showKeys,
                      [provider]: !showKeys[provider],
                    })
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKeys[provider] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href={meta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline">
                  {meta.hrefLabel}
                </a>
              </p>
            </div>
          ))}
        </div>

        {/* Fallback Configuration */}
        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Enable Fallback</h3>
              <p className="text-sm text-muted-foreground">
                Automatically switch to backup provider if primary fails
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
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["gemini", "openai", "euri", "groq"] as Provider[]).map(
                  (p) => (
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
                      <div className="text-xs sm:text-sm font-medium capitalize">
                        {p}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

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
                Save API Settings
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Info */}
      <Card className="p-4 bg-primary/10 border-primary/30">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-primary">
            <p className="font-medium mb-1">Security Note</p>
            <p>
              API keys are stored securely in the database and are never
              returned to the client. Leave a field blank to keep the existing
              key; enter a new value to replace it.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
