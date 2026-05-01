"use client";

import {
  useScroll,
  useTransform,
  useMotionTemplate,
  motion,
  easeInOut,
  useSpring,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import logoLight from "@/public/logo_light.png";
import logoDark from "@/public/logo_dark.png";
import TargetCursor from "@/components/TargetCursor";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#cta" },
  { label: "Support", href: "#footer" },
];

export function Navbar() {
  const handleHashClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#")) return;

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", href);
  };

  const { scrollY } = useScroll();
  const smoothScroll = useSpring(scrollY, {
    stiffness: 200,
    damping: 20,
    restDelta: 0.001,
  });

  const easeConfig = { ease: easeInOut };

  // Interpolation logic
  const borderRadius = useTransform(
    smoothScroll,
    [0, 80],
    [0, 9999],
    easeConfig,
  );
  const paddingX = useTransform(smoothScroll, [0, 80], [40, 24], easeConfig);
  const height = useTransform(smoothScroll, [0, 100], [72, 56], easeConfig);
  const maxWidth = useTransform(smoothScroll, [0, 80], [1400, 720], easeConfig);
  const top = useTransform(smoothScroll, [0, 80], [0, 12], easeConfig);
  const bgOpacity = useTransform(smoothScroll, [0, 80], [0, 0.75], easeConfig);
  const borderOpacity = useTransform(
    smoothScroll,
    [0, 80],
    [0, 0.5],
    easeConfig,
  );
  const shadowOpacity = useTransform(
    smoothScroll,
    [0, 80],
    [0, 0.12],
    easeConfig,
  );

  // Liquid Glass Highlight Opacity
  const highlightOpacity = useTransform(
    smoothScroll,
    [40, 80],
    [0, 0.3],
    easeConfig,
  );
  // Dotted Pattern Opacity
  const dotOpacity = useTransform(
    smoothScroll,
    [40, 80],
    [0, 0.15],
    easeConfig,
  );

  const staticInsetOpacity = useTransform(
    smoothScroll,
    [0, 80],
    [0, 0.05], // Fades from 0 to your original 0.05
    easeConfig,
  );
  // Motion templates
  const background = useMotionTemplate`rgba(var(--nav-bg, 15 23 42) / ${bgOpacity})`;

  // Liquid Glass Effect: Combination of an outer shadow and a very bright inner top-edge highlight
  const boxShadow = useMotionTemplate`
  0 10px 10px rgba(0 0 0 / ${shadowOpacity}),
  inset 0 1px 1px rgba(255 255 255 / ${highlightOpacity}),
  inset 0 0 0 1px rgba(255 255 255 / ${staticInsetOpacity})
`;

  const border = useMotionTemplate`1px solid rgba(var(--nav-border, 71 85 105) / ${borderOpacity})`;

  // Dotted background integrated
  const backgroundImage = useMotionTemplate`radial-gradient(circle, rgba(255, 255, 255, ${dotOpacity}) 1px, transparent 1px)`;

  return (
    <>
      <TargetCursor
        spinDuration={2}
        hideDefaultCursor
        parallaxOn
        hoverDuration={0.2}
      />

      <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none">
        <motion.nav
          style={{
            borderRadius,
            height,
            maxWidth,
            top,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            background,
            backgroundImage,
            backgroundSize: "16px 16px",
            boxShadow,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border,
          }}
          className="pointer-events-auto relative w-[calc(100%-2rem)] flex items-center justify-between dark:border-none will-change-transform overflow-hidden">
          <motion.div
            style={{ opacity: highlightOpacity }}
            className="absolute inset-0 pointer-events-none bg-linear-to-t from-foreground/20 via-primary/10 to-transparent border-t-background border-2 dark:border-none"
          />

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center cursor-target relative z-10">
            <Image
              src={logoLight}
              alt="Clarity"
              height={20}
              className="dark:hidden"
            />
            <Image
              src={logoDark}
              alt="Clarity"
              height={20}
              className="hidden dark:block "
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 relative z-10">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={handleHashClick}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-target">
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-target">
                  {link.label}
                </Link>
              ),
            )}
          </div>

          {/* CTA */}
          <Link href="/auth" className="cursor-target relative z-10">
            <button className="h-9 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
              Try Clarity
            </button>
          </Link>
        </motion.nav>
      </div>
    </>
  );
}
