"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Save, CheckCircle, RotateCcw, Brain } from "lucide-react";
import { usePersonalization } from "@/lib/personalization-context";

export interface ChatbotPersonalization {
  tutorName: string;
  tone: "socratic" | "formal" | "friendly" | "motivating";
  teachingStyle: "concise" | "detailed" | "step-by-step" | "examples";
  customInstructions: string;
}

const DEFAULTS: ChatbotPersonalization = {
  tutorName: "Socrates",
  tone: "socratic",
  teachingStyle: "concise",
  customInstructions: "",
};

const TONES: {
  value: ChatbotPersonalization["tone"];
  label: string;
  description: string;
}[] = [
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and approachable",
  },
  { value: "formal", label: "Formal", description: "Professional and precise" },
  {
    value: "socratic",
    label: "Socratic",
    description: "Guides with questions",
  },
  {
    value: "motivating",
    label: "Motivating",
    description: "Encouraging and uplifting",
  },
];

const STYLES: {
  value: ChatbotPersonalization["teachingStyle"];
  label: string;
  description: string;
}[] = [
  {
    value: "concise",
    label: "Concise",
    description: "Short, to-the-point answers",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Thorough explanations",
  },
  {
    value: "step-by-step",
    label: "Step-by-step",
    description: "Breaks down each step",
  },
  {
    value: "examples",
    label: "Examples-first",
    description: "Leads with examples",
  },
];

export function ChatbotPersonalizationPanel({ userId }: { userId: string }) {
  const {
    personalization: ctxPersonalization,
    setPersonalization: setCtxPersonalization,
  } = usePersonalization();
  const [settings, setSettings] = useState<ChatbotPersonalization>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/settings/chatbot?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.personalization) {
          setSettings({ ...DEFAULTS, ...data.personalization });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/chatbot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, personalization: settings }),
      });
      // Push to context so all consumers (e.g. MessageBubble) update instantly
      setCtxPersonalization(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setSettings(DEFAULTS);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse h-48 bg-muted rounded-3xl" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground mb-6">
        Customise how Clarity speaks and teaches.
      </p>

      <div className="space-y-6">
        {/* Tutor Name */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Tutor Name
          </label>
          <Input
            value={settings.tutorName}
            onChange={(e) =>
              setSettings({ ...settings, tutorName: e.target.value })
            }
            placeholder="e.g. Marcus, Grace, Alex…"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Clarity will refer to itself by this name.
          </p>
        </div>

        {/* Tone */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Personality & Tone
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSettings({ ...settings, tone: t.value })}
                className={`relative group rounded-3xl border p-4 text-left transition-colors ${
                  settings.tone === t.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                }`}>
                <p className="text-sm font-medium leading-none">{t.label}</p>
                <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {t.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Teaching Style */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Teaching Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() =>
                  setSettings({ ...settings, teachingStyle: s.value })
                }
                className={`relative group rounded-3xl border p-4 text-left transition-colors ${
                  settings.teachingStyle === s.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                }`}>
                <p className="text-sm font-medium leading-none">{s.label}</p>
                <span className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {s.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Custom Instructions{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <textarea
            value={settings.customInstructions}
            onChange={(e) =>
              setSettings({ ...settings, customInstructions: e.target.value })
            }
            placeholder="e.g. Always reference real-world examples. Assume I have A-level maths background."
            rows={3}
            maxLength={500}
            className="w-full rounded-3xl border border-input bg-background px-4 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {settings.customInstructions.length}/500
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center flex-wrap gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save Changes"}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
            size="sm">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </Button>
        </div>
      </div>
    </Card>
  );
}
