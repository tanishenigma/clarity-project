"use client";

import { useEffect, useState } from "react";
import {
  COLOR_THEMES,
  applyColorTheme,
  getSavedColorTheme,
} from "@/lib/color-themes";
import { Check } from "lucide-react";

export function ThemeColorPicker() {
  const [active, setActive] = useState<string | null>(null);

  /* Sync with localStorage on mount */
  useEffect(() => {
    setActive(getSavedColorTheme());
  }, []);

  function handleSelect(id: string) {
    const next = active === id ? null : id;
    applyColorTheme(next);
    setActive(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Color Theme</p>
      <p className="text-xs text-muted-foreground">
        Choose a colour palette for the entire app.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {/* Default option (uses globals.css base) */}
        <button
          onClick={() => handleSelect("cobalt-blue")}
          aria-label="Default theme"
          className={`group relative flex flex-col items-start gap-2 rounded-sm border p-3 text-left transition-all duration-200 hover:border-primary/60 hover:bg-muted/40 ${
            active === "cobalt-blue" || active === null
              ? "border-primary bg-primary/8"
              : "border-border bg-card"
          }`}>
          <SwatchDots light="oklch(0.52 0.2 252)" dark="oklch(0.6 0.22 252)" />
          <span className="text-xs font-medium text-foreground leading-tight">
            Cobalt Blue
          </span>
          {(active === "cobalt-blue" || active === null) && <ActiveBadge />}
        </button>

        {COLOR_THEMES.filter((t) => t.id !== "cobalt-blue").map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme.id)}
            aria-label={`${theme.name} theme`}
            className={`group relative flex flex-col items-start gap-2 rounded-sm border p-3 text-left transition-all duration-200 hover:border-primary/60 hover:bg-muted/40 ${
              active === theme.id
                ? "border-primary bg-primary/8"
                : "border-border bg-card"
            }`}>
            <SwatchDots
              light={theme.light["--primary"] ?? theme.swatch}
              dark={theme.dark["--primary"] ?? theme.swatch}
            />
            <span className="text-xs font-medium text-foreground leading-tight">
              {theme.name}
            </span>
            {active === theme.id && <ActiveBadge />}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwatchDots({ light, dark }: { light: string; dark: string }) {
  return (
    <div className="flex gap-1.5">
      <span
        className="inline-block w-5 h-5 rounded-full border border-black/10 shadow-sm"
        style={{ background: light }}
        title="Light mode colour"
      />
      <span
        className="inline-block w-5 h-5 rounded-full border border-white/10 shadow-sm"
        style={{ background: dark }}
        title="Dark mode colour"
      />
    </div>
  );
}

function ActiveBadge() {
  return (
    <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-primary">
      <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
    </span>
  );
}
