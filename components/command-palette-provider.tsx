"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";

const CommandPalette = dynamic(
  () =>
    import("@/components/command-palette").then(
      (module) => module.CommandPalette,
    ),
  {
    ssr: false,
  },
);

/**
 * Wraps the app shell to mount the floating Command Palette (Cmd+K)
 * and a globally-accessible Settings Dialog.
 * The Sidebar also has a Settings trigger — both share the same dialog
 * via a custom DOM event ("open-settings-dialog").
 */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Allow any component to open the settings dialog via a global event
  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("open-settings-dialog", handler);
    return () => window.removeEventListener("open-settings-dialog", handler);
  }, []);

  return (
    <>
      {children}
      <CommandPalette
        onOpenSettings={() =>
          window.dispatchEvent(new Event("open-settings-dialog"))
        }
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
