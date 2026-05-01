import React, { useRef, useEffect, useState, useCallback } from "react";
import { gsap } from "gsap";

export interface BentoCardProps {
  title?: string;
  description?: string;
  label?: string;
  illustration?: React.ReactNode;
  textAutoHide?: boolean;
  disableAnimations?: boolean;
}

export interface BentoProps {
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
// Cobalt blue (approx RGB of --primary oklch(0.52 0.2 252))
const DEFAULT_GLOW_COLOR = "59, 120, 230";
const MOBILE_BREAKPOINT = 768;

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const WorkspacesIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <rect
      x="8"
      y="12"
      width="52"
      height="38"
      rx="6"
      className="bento-fill-primary-15 bento-stroke-primary-40"
      strokeWidth="1"
    />
    <rect
      x="12"
      y="16"
      width="44"
      height="6"
      rx="2"
      className="bento-fill-primary-30"
    />
    <rect
      x="12"
      y="25"
      width="30"
      height="3"
      rx="1.5"
      className="bento-fill-fg-15"
    />
    <rect
      x="12"
      y="30"
      width="22"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="12"
      y="35"
      width="28"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="68"
      y="12"
      width="52"
      height="38"
      rx="6"
      className="bento-fill-primary-10 bento-stroke-primary-25"
      strokeWidth="1"
    />
    <rect
      x="72"
      y="16"
      width="44"
      height="6"
      rx="2"
      className="bento-fill-primary-20"
    />
    <rect
      x="72"
      y="25"
      width="26"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="72"
      y="30"
      width="36"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
    <rect
      x="72"
      y="35"
      width="20"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
    <rect
      x="8"
      y="58"
      width="112"
      height="32"
      rx="6"
      className="bento-fill-primary-08 bento-stroke-primary-20"
      strokeWidth="1"
    />
    <rect
      x="12"
      y="62"
      width="60"
      height="6"
      rx="2"
      className="bento-fill-primary-15"
    />
    <rect
      x="12"
      y="71"
      width="90"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
    <rect
      x="12"
      y="76"
      width="70"
      height="3"
      rx="1.5"
      className="bento-fill-fg-06"
    />
    <circle
      cx="130"
      cy="31"
      r="14"
      className="bento-fill-primary-12 bento-stroke-primary-35"
      strokeWidth="1"
    />
    <path
      d="M125 31 L130 26 L135 31 M130 26 L130 36"
      className="bento-stroke-primary-80"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ClarityIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <rect
      x="10"
      y="18"
      width="90"
      height="28"
      rx="14"
      className="bento-fill-primary-15 bento-stroke-primary-35"
      strokeWidth="1"
    />
    <rect
      x="20"
      y="28"
      width="16"
      height="8"
      rx="4"
      className="bento-fill-primary-50"
    />
    <rect
      x="42"
      y="28"
      width="24"
      height="8"
      rx="4"
      className="bento-fill-fg-15"
    />
    <rect
      x="72"
      y="28"
      width="18"
      height="8"
      rx="4"
      className="bento-fill-fg-10"
    />
    <path
      d="M100 32 L110 32"
      className="bento-stroke-primary-40"
      strokeWidth="1"
      strokeDasharray="2 2"
    />
    <circle cx="114" cy="32" r="3" className="bento-fill-primary-60" />
    <rect
      x="60"
      y="56"
      width="90"
      height="28"
      rx="14"
      className="bento-fill-primary-10 bento-stroke-primary-25"
      strokeWidth="1"
    />
    <rect
      x="70"
      y="66"
      width="20"
      height="8"
      rx="4"
      className="bento-fill-fg-12"
    />
    <rect
      x="96"
      y="66"
      width="30"
      height="8"
      rx="4"
      className="bento-fill-primary-30"
    />
    <path
      d="M60 56 L50 56"
      className="bento-stroke-primary-30"
      strokeWidth="1"
      strokeDasharray="2 2"
    />
    <circle cx="46" cy="56" r="3" className="bento-fill-primary-50" />
    <circle
      cx="22"
      cy="70"
      r="10"
      className="bento-fill-primary-12 bento-stroke-primary-30"
      strokeWidth="1"
    />
    <path
      d="M22 65 Q22 70 22 72 M22 74 L22 75"
      className="bento-stroke-primary-70"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const AnalyticsIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <line
      x1="15"
      y1="85"
      x2="145"
      y2="85"
      className="bento-stroke-fg-10"
      strokeWidth="1"
    />
    <line
      x1="15"
      y1="85"
      x2="15"
      y2="15"
      className="bento-stroke-fg-10"
      strokeWidth="1"
    />
    <line
      x1="15"
      y1="65"
      x2="145"
      y2="65"
      className="bento-stroke-fg-05"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <line
      x1="15"
      y1="45"
      x2="145"
      y2="45"
      className="bento-stroke-fg-05"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <line
      x1="15"
      y1="25"
      x2="145"
      y2="25"
      className="bento-stroke-fg-05"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
    <path
      d="M15 75 C35 68 55 72 75 55 C95 38 115 42 145 22"
      className="bento-stroke-primary-60"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M15 75 C35 68 55 72 75 55 C95 38 115 42 145 22 L145 85 L15 85 Z"
      className="bento-fill-primary-gradient"
      opacity="0.3"
    />
    <circle
      cx="75"
      cy="55"
      r="3.5"
      className="bento-fill-primary bento-stroke-fg-40"
      strokeWidth="1.5"
    />
    <circle
      cx="115"
      cy="42"
      r="3.5"
      className="bento-fill-primary bento-stroke-fg-40"
      strokeWidth="1.5"
    />
    <circle
      cx="145"
      cy="22"
      r="3.5"
      className="bento-fill-primary bento-stroke-fg-40"
      strokeWidth="1.5"
    />
    <rect
      x="100"
      y="10"
      width="44"
      height="22"
      rx="5"
      className="bento-fill-card bento-stroke-primary-40"
      strokeWidth="1"
    />
    <text
      x="110"
      y="25"
      className="bento-text-primary"
      fontSize="10"
      fontFamily="monospace">
      +24%
    </text>
  </svg>
);

const FlashcardsIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <rect
      x="45"
      y="22"
      width="80"
      height="56"
      rx="8"
      className="bento-fill-primary-08 bento-stroke-primary-20"
      strokeWidth="1"
      transform="rotate(-6 85 50)"
    />
    <rect
      x="40"
      y="18"
      width="80"
      height="56"
      rx="8"
      className="bento-fill-primary-12 bento-stroke-primary-30"
      strokeWidth="1"
      transform="rotate(-2 80 46)"
    />
    <rect
      x="35"
      y="15"
      width="80"
      height="56"
      rx="8"
      className="bento-fill-card bento-stroke-primary-50"
      strokeWidth="1.5"
    />
    <rect
      x="42"
      y="22"
      width="66"
      height="8"
      rx="3"
      className="bento-fill-primary-25"
    />
    <rect
      x="42"
      y="35"
      width="50"
      height="4"
      rx="2"
      className="bento-fill-fg-12"
    />
    <rect
      x="42"
      y="42"
      width="60"
      height="4"
      rx="2"
      className="bento-fill-fg-08"
    />
    <rect
      x="42"
      y="49"
      width="44"
      height="4"
      rx="2"
      className="bento-fill-fg-08"
    />
    <rect
      x="42"
      y="58"
      width="30"
      height="10"
      rx="5"
      className="bento-fill-primary-30 bento-stroke-primary-50"
      strokeWidth="1"
    />
    <text
      x="44"
      y="66"
      className="bento-text-primary"
      fontSize="7"
      fontFamily="monospace">
      Review
    </text>
    <circle
      cx="120"
      cy="65"
      r="10"
      className="bento-fill-primary-15 bento-stroke-primary-40"
      strokeWidth="1"
    />
    <path
      d="M115 65 L119 69 L125 61"
      className="bento-stroke-primary-90"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NotesIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <rect
      x="20"
      y="10"
      width="75"
      height="80"
      rx="6"
      className="bento-fill-primary-08 bento-stroke-primary-25"
      strokeWidth="1"
    />
    <rect
      x="20"
      y="10"
      width="75"
      height="14"
      rx="6"
      className="bento-fill-primary-20"
    />
    <rect
      x="20"
      y="18"
      width="75"
      height="6"
      className="bento-fill-primary-20"
    />
    <rect
      x="28"
      y="32"
      width="52"
      height="3"
      rx="1.5"
      className="bento-fill-fg-15"
    />
    <rect
      x="28"
      y="39"
      width="44"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="28"
      y="46"
      width="48"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="28"
      y="53"
      width="36"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
    <rect
      x="28"
      y="60"
      width="50"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
    <rect
      x="28"
      y="67"
      width="40"
      height="3"
      rx="1.5"
      className="bento-fill-fg-06"
    />
    <rect
      x="28"
      y="74"
      width="28"
      height="3"
      rx="1.5"
      className="bento-fill-fg-06"
    />
    <rect
      x="105"
      y="35"
      width="38"
      height="48"
      rx="6"
      className="bento-fill-primary-12 bento-stroke-primary-35"
      strokeWidth="1"
    />
    <path
      d="M128 42 L136 50 L118 68 L110 68 L110 60 Z"
      className="bento-fill-primary-20 bento-stroke-primary-60"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <line
      x1="122"
      y1="48"
      x2="130"
      y2="56"
      className="bento-stroke-primary-40"
      strokeWidth="1"
    />
  </svg>
);

const QuizIllustration = () => (
  <svg
    viewBox="0 0 160 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full">
    <circle
      cx="80"
      cy="50"
      r="36"
      className="bento-fill-primary-08 bento-stroke-primary-20"
      strokeWidth="1"
    />
    <circle
      cx="80"
      cy="50"
      r="36"
      fill="none"
      className="bento-stroke-primary"
      strokeWidth="3"
      strokeDasharray="56.5 56.5"
      strokeDashoffset="14"
      strokeLinecap="round"
      transform="rotate(-90 80 50)"
    />
    <circle cx="80" cy="50" r="26" className="bento-fill-card" opacity="0.9" />
    <text
      x="66"
      y="55"
      className="bento-text-primary"
      fontSize="13"
      fontWeight="bold"
      fontFamily="monospace">
      75%
    </text>
    <rect
      x="122"
      y="18"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-15 bento-stroke-primary-35"
      strokeWidth="1"
    />
    <path
      d="M128 27 L131 30 L137 24"
      className="bento-stroke-primary-90"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="122"
      y="42"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-10 bento-stroke-primary-25"
      strokeWidth="1"
    />
    <path
      d="M128 51 L131 54 L137 48"
      className="bento-stroke-primary-70"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="122"
      y="66"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-06 bento-stroke-primary-20"
      strokeWidth="1"
    />
    <line
      x1="128"
      y1="75"
      x2="144"
      y2="75"
      className="bento-stroke-fg-15"
      strokeWidth="1.5"
    />
    <rect
      x="10"
      y="18"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-10 bento-stroke-primary-25"
      strokeWidth="1"
    />
    <rect
      x="10"
      y="42"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-08 bento-stroke-primary-20"
      strokeWidth="1"
    />
    <rect
      x="10"
      y="66"
      width="28"
      height="18"
      rx="4"
      className="bento-fill-primary-06 bento-stroke-primary-15"
      strokeWidth="1"
    />
    <rect
      x="14"
      y="25"
      width="20"
      height="3"
      rx="1.5"
      className="bento-fill-fg-15"
    />
    <rect
      x="14"
      y="49"
      width="16"
      height="3"
      rx="1.5"
      className="bento-fill-fg-10"
    />
    <rect
      x="14"
      y="73"
      width="18"
      height="3"
      rx="1.5"
      className="bento-fill-fg-08"
    />
  </svg>
);

// ─── Card Data ────────────────────────────────────────────────────────────────

const cardData: BentoCardProps[] = [
  {
    title: "Workspaces",
    description:
      "Organize every subject in its own dedicated space — notes, resources, and tasks all in one place.",
    label: "Organize",
    illustration: <WorkspacesIllustration />,
  },
  {
    title: "Clarity AI",
    description:
      "Get 24/7 AI-powered explanations tailored to your level, from quick answers to deep dives.",
    label: "Understand",
    illustration: <ClarityIllustration />,
  },
  {
    title: "Analytics",
    description:
      "Track your progress with detailed learning insights. See what's sticking and what needs more work.",
    label: "Progress",
    illustration: <AnalyticsIllustration />,
  },
  {
    title: "Flashcards",
    description:
      "Spaced repetition that locks knowledge in. Cards adapt to your memory patterns automatically.",
    label: "Memorize",
    illustration: <FlashcardsIllustration />,
  },
  {
    title: "Smart Notes",
    description:
      "Take rich, linked notes that connect across subjects. Highlight, annotate, and summarize instantly.",
    label: "Capture",
    illustration: <NotesIllustration />,
  },
  {
    title: "Practice Quizzes",
    description:
      "Auto-generated quizzes from your own material. Test yourself before the real thing.",
    label: "Test",
    illustration: <QuizIllustration />,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const createParticleElement = (
  x: number,
  y: number,
  color: string = DEFAULT_GLOW_COLOR,
): HTMLDivElement => {
  const el = document.createElement("div");
  el.className = "bento-particle";
  el.style.cssText = `
    position: absolute; width: 4px; height: 4px; border-radius: 50%;
    background: rgba(${color}, 1); box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none; z-index: 100; left: ${x}px; top: ${y}px;
  `;
  return el;
};

const calculateSpotlightValues = (radius: number) => ({
  proximity: radius * 0.5,
  fadeDistance: radius * 0.75,
});

const updateCardGlowProperties = (
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  glow: number,
  radius: number,
) => {
  const r = card.getBoundingClientRect();
  card.style.setProperty("--glow-x", `${((mouseX - r.left) / r.width) * 100}%`);
  card.style.setProperty("--glow-y", `${((mouseY - r.top) / r.height) * 100}%`);
  card.style.setProperty("--glow-intensity", glow.toString());
  card.style.setProperty("--glow-radius", `${radius}px`);
};

// ─── ParticleCard ─────────────────────────────────────────────────────────────

const ParticleCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  disableAnimations?: boolean;
  style?: React.CSSProperties;
  particleCount?: number;
  glowColor?: string;
  enableTilt?: boolean;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}> = ({
  children,
  className = "",
  disableAnimations = false,
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  enableTilt = true,
  clickEffect = false,
  enableMagnetism = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);
  const particlesInitialized = useRef(false);
  const magnetismRef = useRef<gsap.core.Tween | null>(null);

  const initializeParticles = useCallback(() => {
    if (particlesInitialized.current || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    memoizedParticles.current = Array.from({ length: particleCount }, () =>
      createParticleElement(
        Math.random() * width,
        Math.random() * height,
        glowColor,
      ),
    );
    particlesInitialized.current = true;
  }, [particleCount, glowColor]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    magnetismRef.current?.kill();
    particlesRef.current.forEach((p) =>
      gsap.to(p, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: "back.in(1.7)",
        onComplete: () => {
          p.parentNode?.removeChild(p);
        },
      }),
    );
    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;
    if (!particlesInitialized.current) initializeParticles();
    memoizedParticles.current.forEach((particle, i) => {
      const id = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const clone = particle.cloneNode(true) as HTMLDivElement;
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);
        gsap.fromTo(
          clone,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" },
        );
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: "none",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: "power2.inOut",
          repeat: -1,
          yoyo: true,
        });
      }, i * 100);
      timeoutsRef.current.push(id);
    });
  }, [initializeParticles]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;
    const el = cardRef.current;

    const onEnter = () => {
      isHoveredRef.current = true;
      animateParticles();
      if (enableTilt)
        gsap.to(el, {
          rotateX: 5,
          rotateY: 5,
          duration: 0.3,
          ease: "power2.out",
          transformPerspective: 1000,
        });
    };
    const onLeave = () => {
      isHoveredRef.current = false;
      clearAllParticles();
      if (enableTilt)
        gsap.to(el, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.3,
          ease: "power2.out",
        });
      if (enableMagnetism)
        gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
    };
    const onMove = (e: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const cx = rect.width / 2,
        cy = rect.height / 2;
      if (enableTilt)
        gsap.to(el, {
          rotateX: ((y - cy) / cy) * -10,
          rotateY: ((x - cx) / cx) * 10,
          duration: 0.1,
          ease: "power2.out",
          transformPerspective: 1000,
        });
      if (enableMagnetism)
        magnetismRef.current = gsap.to(el, {
          x: (x - cx) * 0.05,
          y: (y - cy) * 0.05,
          duration: 0.3,
          ease: "power2.out",
        });
    };
    const onClick = (e: MouseEvent) => {
      if (!clickEffect) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const d = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      );
      const ripple = document.createElement("div");
      ripple.style.cssText = `position:absolute;width:${d * 2}px;height:${d * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(${glowColor},0.35) 0%,rgba(${glowColor},0.15) 30%,transparent 70%);left:${x - d}px;top:${y - d}px;pointer-events:none;z-index:1000;`;
      el.appendChild(ripple);
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => ripple.remove(),
        },
      );
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("click", onClick);
    return () => {
      isHoveredRef.current = false;
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("click", onClick);
      clearAllParticles();
    };
  }, [
    animateParticles,
    clearAllParticles,
    disableAnimations,
    enableTilt,
    enableMagnetism,
    clickEffect,
    glowColor,
  ]);

  return (
    <div
      ref={cardRef}
      className={`${className} relative overflow-hidden`}
      style={{ ...style, position: "relative", overflow: "hidden" }}>
      {children}
    </div>
  );
};

// ─── GlobalSpotlight ──────────────────────────────────────────────────────────

const GlobalSpotlight: React.FC<{
  gridRef: React.RefObject<HTMLDivElement | null>;
  disableAnimations?: boolean;
  enabled?: boolean;
  spotlightRadius?: number;
  glowColor?: string;
}> = ({
  gridRef,
  disableAnimations = false,
  enabled = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = DEFAULT_GLOW_COLOR,
}) => {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableAnimations || !gridRef?.current || !enabled) return;
    const spotlight = document.createElement("div");
    spotlight.style.cssText = `position:fixed;width:800px;height:800px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(${glowColor},0.1) 0%,rgba(${glowColor},0.05) 20%,rgba(${glowColor},0.02) 35%,transparent 65%);z-index:200;opacity:0;transform:translate(-50%,-50%);mix-blend-mode:screen;`;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const onMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !gridRef.current) return;
      const section = gridRef.current.closest(".bento-section");
      const rect = section?.getBoundingClientRect();
      const inside =
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      const cards = gridRef.current.querySelectorAll(".bento-card");
      if (!inside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 });
        cards.forEach((c) =>
          (c as HTMLElement).style.setProperty("--glow-intensity", "0"),
        );
        return;
      }
      const { proximity, fadeDistance } =
        calculateSpotlightValues(spotlightRadius);
      let minDist = Infinity;
      cards.forEach((c) => {
        const cel = c as HTMLElement,
          cr = cel.getBoundingClientRect();
        const dist = Math.max(
          0,
          Math.hypot(
            e.clientX - (cr.left + cr.width / 2),
            e.clientY - (cr.top + cr.height / 2),
          ) -
            Math.max(cr.width, cr.height) / 2,
        );
        minDist = Math.min(minDist, dist);
        const intensity =
          dist <= proximity
            ? 1
            : dist <= fadeDistance
              ? (fadeDistance - dist) / (fadeDistance - proximity)
              : 0;
        updateCardGlowProperties(
          cel,
          e.clientX,
          e.clientY,
          intensity,
          spotlightRadius,
        );
      });
      gsap.to(spotlightRef.current, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
      });
      const opacity =
        minDist <= proximity
          ? 0.8
          : minDist <= fadeDistance
            ? ((fadeDistance - minDist) / (fadeDistance - proximity)) * 0.8
            : 0;
      gsap.to(spotlightRef.current, {
        opacity,
        duration: opacity > 0 ? 0.2 : 0.5,
      });
    };
    const onLeave = () => {
      gridRef.current
        ?.querySelectorAll(".bento-card")
        .forEach((c) =>
          (c as HTMLElement).style.setProperty("--glow-intensity", "0"),
        );
      if (spotlightRef.current)
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current);
    };
  }, [gridRef, disableAnimations, enabled, spotlightRadius, glowColor]);

  return null;
};

// ─── useMobileDetection ───────────────────────────────────────────────────────

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

// ─── MagicBento ───────────────────────────────────────────────────────────────

const MagicBento: React.FC<BentoProps> = ({
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();
  const shouldDisableAnimations = disableAnimations || isMobile;

  return (
    <>
      <style>{`
        /* ── SVG utility classes — read from theme CSS vars ─────────────────── */

        /* Fills: primary */
        .bento-fill-primary    { fill: var(--primary); }
        .bento-fill-primary-60 { fill: oklch(from var(--primary) l c h / 0.60); }
        .bento-fill-primary-50 { fill: oklch(from var(--primary) l c h / 0.50); }
        .bento-fill-primary-30 { fill: oklch(from var(--primary) l c h / 0.30); }
        .bento-fill-primary-25 { fill: oklch(from var(--primary) l c h / 0.25); }
        .bento-fill-primary-20 { fill: oklch(from var(--primary) l c h / 0.20); }
        .bento-fill-primary-15 { fill: oklch(from var(--primary) l c h / 0.15); }
        .bento-fill-primary-12 { fill: oklch(from var(--primary) l c h / 0.12); }
        .bento-fill-primary-10 { fill: oklch(from var(--primary) l c h / 0.10); }
        .bento-fill-primary-08 { fill: oklch(from var(--primary) l c h / 0.08); }
        .bento-fill-primary-06 { fill: oklch(from var(--primary) l c h / 0.06); }

        /* Fills: foreground */
        .bento-fill-fg-40 { fill: oklch(from var(--foreground) l c h / 0.40); }
        .bento-fill-fg-15 { fill: oklch(from var(--foreground) l c h / 0.15); }
        .bento-fill-fg-12 { fill: oklch(from var(--foreground) l c h / 0.12); }
        .bento-fill-fg-10 { fill: oklch(from var(--foreground) l c h / 0.10); }
        .bento-fill-fg-08 { fill: oklch(from var(--foreground) l c h / 0.08); }
        .bento-fill-fg-06 { fill: oklch(from var(--foreground) l c h / 0.06); }

        /* Fills: semantic */
        .bento-fill-card              { fill: var(--card); }
        .bento-fill-primary-gradient  { fill: url(#bentoGrad); }

        /* Strokes: primary */
        .bento-stroke-primary    { stroke: var(--primary); }
        .bento-stroke-primary-90 { stroke: oklch(from var(--primary) l c h / 0.90); }
        .bento-stroke-primary-80 { stroke: oklch(from var(--primary) l c h / 0.80); }
        .bento-stroke-primary-70 { stroke: oklch(from var(--primary) l c h / 0.70); }
        .bento-stroke-primary-60 { stroke: oklch(from var(--primary) l c h / 0.60); }
        .bento-stroke-primary-50 { stroke: oklch(from var(--primary) l c h / 0.50); }
        .bento-stroke-primary-40 { stroke: oklch(from var(--primary) l c h / 0.40); }
        .bento-stroke-primary-35 { stroke: oklch(from var(--primary) l c h / 0.35); }
        .bento-stroke-primary-30 { stroke: oklch(from var(--primary) l c h / 0.30); }
        .bento-stroke-primary-25 { stroke: oklch(from var(--primary) l c h / 0.25); }
        .bento-stroke-primary-20 { stroke: oklch(from var(--primary) l c h / 0.20); }
        .bento-stroke-primary-15 { stroke: oklch(from var(--primary) l c h / 0.15); }

        /* Strokes: foreground */
        .bento-stroke-fg-40 { stroke: oklch(from var(--foreground) l c h / 0.40); }
        .bento-stroke-fg-15 { stroke: oklch(from var(--foreground) l c h / 0.15); }
        .bento-stroke-fg-10 { stroke: oklch(from var(--foreground) l c h / 0.10); }
        .bento-stroke-fg-05 { stroke: oklch(from var(--foreground) l c h / 0.05); }

        /* Text */
        .bento-text-primary { fill: var(--primary); }

        /* ── Grid ─────────────────────────────────────────────────────────── */
        .bento-section {
          --glow-x: 50%;
          --glow-y: 50%;
          --glow-intensity: 0;
          --glow-radius: 200px;
        }

        .bento-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
          width: 90%;
          margin: 0 auto;
          padding: 0.5rem;
        }

        @media (min-width: 600px) {
          .bento-card-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 1024px) {
          .bento-card-grid { grid-template-columns: repeat(4, 1fr); }
          .bento-card-grid .bento-card:nth-child(3) { grid-column: span 2; grid-row: span 2; }
          .bento-card-grid .bento-card:nth-child(4) { grid-column: 1 / span 2; grid-row: 2 / span 2; }
          .bento-card-grid .bento-card:nth-child(6) { grid-column: 4; grid-row: 3; }
        }

        @media (max-width: 599px) {
          .bento-card-grid { grid-template-columns: 1fr; width: 90%; margin: 0 auto; }
          .bento-card-grid .bento-card { min-height: 200px; }
        }

        /* ── Card ─────────────────────────────────────────────────────────── */
        .bento-card {
          background-color: var(--card);
          border-color: var(--border);
          color: var(--card-foreground);
          --glow-x: 50%;
          --glow-y: 50%;
          --glow-intensity: 0;
          --glow-radius: 200px;
          transition: background-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }

        .bento-card:hover {
      
          box-shadow:
            0 4px 24px oklch(from var(--primary) l c h / 0.10),
            0 0 40px oklch(from var(--primary) l c h / 0.06);
        }

        /* Light mode subtle override */
        :root .bento-card:hover {
          background-color: color-mix(in oklch, var(--card) 92%, var(--primary) 8%);
        }

        /* ── Border glow ──────────────────────────────────────────────────── */
        .bento-card--border-glow::after {
          content: '';
          position: absolute;
          inset: 0;
          padding: 6px;
          background: radial-gradient(
            var(--glow-radius) circle at var(--glow-x) var(--glow-y),
            oklch(from var(--primary) l c h / calc(var(--glow-intensity) * 0.65)) 0%,
            oklch(from var(--primary) l c h / calc(var(--glow-intensity) * 0.30)) 30%,
            transparent 60%
          );
          border-radius: inherit;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          z-index: 1;
        }

        /* ── Illustration ─────────────────────────────────────────────────── */
        .bento-card__illustration {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          opacity: 0.72;
          transition: opacity 0.3s ease;
        }

        .bento-card:hover .bento-card__illustration { opacity: 1; }
        .bento-card__illustration svg { max-height: 100%; width: 100%; }

        /* ── Text helpers ─────────────────────────────────────────────────── */
        .bento-text-clamp-1 {
          display: -webkit-box; -webkit-box-orient: vertical;
          -webkit-line-clamp: 1; overflow: hidden; text-overflow: ellipsis;
        }
        .bento-text-clamp-2 {
          display: -webkit-box; -webkit-box-orient: vertical;
          -webkit-line-clamp: 2; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Particle ─────────────────────────────────────────────────────── */
        .bento-particle::before {
          content: ''; position: absolute; inset: -2px;
          background: oklch(from var(--primary) l c h / 0.18);
          border-radius: 50%; z-index: -1;
        }
      `}</style>

      {/* Shared SVG gradient (analytics card fill) */}
      <svg
        width="0"
        height="0"
        style={{ position: "absolute", pointerEvents: "none" }}>
        <defs>
          <linearGradient id="bentoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
        />
      )}

      <div
        className="bento-section select-none relative"
        style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.5rem)" }}
        ref={gridRef}>
        <div className="bento-card-grid">
          {cardData.map((card, index) => {
            const cardClassName = [
              "bento-card",
              "flex flex-col justify-between",
              "relative aspect-[4/3] min-h-[200px] w-full max-w-full p-5",
              "rounded-[var(--radius)] border border-solid font-light",
              "overflow-hidden hover:-translate-y-[2px]",
              enableBorderGlow ? "bento-card--border-glow" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const cardContent = (
              <>
                {/* Label */}
                <div className="flex justify-between gap-3 relative z-10">
                  <span
                    className="text-xs tracking-widest uppercase font-medium"
                    style={{ color: "var(--muted-foreground)" }}>
                    {card.label}
                  </span>
                </div>

                {/* Illustration */}
                {card.illustration && (
                  <div className="bento-card__illustration z-10 py-1">
                    {card.illustration}
                  </div>
                )}

                {/* Text */}
                <div className="flex flex-col relative z-10">
                  <h3
                    className={`font-semibold text-sm m-0 mb-1 ${textAutoHide ? "bento-text-clamp-1" : ""}`}
                    style={{ color: "var(--card-foreground)" }}>
                    {card.title}
                  </h3>
                  <p
                    className={`text-xs leading-5 ${textAutoHide ? "bento-text-clamp-2" : ""}`}
                    style={{ color: "var(--muted-foreground)" }}>
                    {card.description}
                  </p>
                </div>
              </>
            );

            if (enableStars) {
              return (
                <ParticleCard
                  key={index}
                  className={cardClassName}
                  disableAnimations={shouldDisableAnimations}
                  particleCount={particleCount}
                  glowColor={glowColor}
                  enableTilt={enableTilt}
                  clickEffect={clickEffect}
                  enableMagnetism={enableMagnetism}>
                  {cardContent}
                </ParticleCard>
              );
            }

            return (
              <div key={index} className={cardClassName}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default MagicBento;
