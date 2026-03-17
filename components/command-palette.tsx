"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  // FolderInput,
  // BarChart3,
  Layers2,
  SquarePen,
  Settings,
  // BookOpen,
  Sparkles,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface CommandPaletteProps {
  onOpenSettings?: () => void;
}

export function CommandPalette({ onOpenSettings }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          e.key === "/" &&
          (e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement)
        )
          return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 60);
  }, []);

  const pages = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      shortcut: "D",
    },
    {
      label: "Add Content",
      icon: Plus,
      href: "/add-content",
      shortcut: "A",
    },
    { label: "Spaces", icon: Layers2, href: "/spaces", shortcut: "S" },
    { label: "Chat", icon: SquarePen, href: "/chat", shortcut: "C" },
    // { label: "Analytics", icon:  href: "/study/analytics", shortcut: "E" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette">
      <CommandInput placeholder="Search pages, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {pages.map(({ label, icon: Icon, href, shortcut }) => (
            <CommandItem
              key={href}
              onSelect={() => run(() => router.push(href))}>
              <Icon />
              {label}
              {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => router.push("/add-content"))}>
            <Sparkles />
            Start learning something new
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/chat"))}>
            <SquarePen />
            New AI Chat conversation
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                onOpenSettings?.();
              })
            }>
            <Settings />
            Open Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => run(logout)}
            className="text-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive">
            <LogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
