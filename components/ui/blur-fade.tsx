"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAnimationStore } from "@/lib/stores/use-animation-store";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
}

export const BlurFade = ({
  children,
  className,
  delay = 0,
  yOffset = 24,
}: BlurFadeProps) => {
  const { duration, ease } = useAnimationStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration,
        delay,
        ease,
      }}
      className={cn("w-full", className)}>
      {children}
    </motion.div>
  );
};
