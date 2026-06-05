import { create } from "zustand";

interface AnimationConfig {
  duration: number;
  ease: number[];
  setDuration: (duration: number) => void;
  setEase: (ease: number[]) => void;
}

export const useAnimationStore = create<AnimationConfig>((set) => ({
  duration: 0.9,
  ease: [0.21, 0.47, 0.32, 0.98],
  setDuration: (duration) => set({ duration }),
  setEase: (ease) => set({ ease }),
}));
