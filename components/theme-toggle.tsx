"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useThemeStore } from "@/lib/stores/useThemeStore";

export function ThemeToggle() {
  // Grab the state and the action directly from Zustand
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={cn(
        "relative flex h-6 w-11 items-center rounded-full cursor-pointer p-1 select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "transition-colors duration-300 ease-in-out",
        isDark
          ? "bg-primary justify-end"
          : "bg-muted-foreground/30 justify-start",
      )}
      onClick={toggleTheme}>
      <motion.span
        layout
        transition={{
          type: "spring",
          stiffness: 700,
          damping: 30,
        }}
        className="inline-block h-4 w-4 rounded-full bg-white shadow-md pointer-events-none"
      />
    </button>
  );
}
