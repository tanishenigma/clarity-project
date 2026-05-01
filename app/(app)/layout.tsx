import type React from "react";
import { Sidebar } from "@/components/sidebar";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
// import { QuickNotes } from "@/components/quick-notes";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 md:p-8 pt-16 md:pt-8 pb-6 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
