import type React from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { getCurrentUser } from "@/lib/auth";
// import { QuickNotes } from "@/components/quick-notes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 sm:p-6 md:p-8 pt-16 md:pt-8 pb-6 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
