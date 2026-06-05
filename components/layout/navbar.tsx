"use client";

import {
  useScroll,
  useTransform,
  useMotionTemplate,
  motion,
  easeInOut,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, VenetianMask, X } from "lucide-react";

import TargetCursor from "@/components/TargetCursor";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleHashClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    if (!href) return;

    if (href.startsWith("/#")) {
      setMobileOpen(false);
      return;
    }

    if (!href.startsWith("#")) return;

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    setMobileOpen(false);
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

  const borderRadius = useTransform(
    smoothScroll,
    [0, 80],
    [0, 9999],
    easeConfig,
  );

  // FIX 1: Reduced padding values so the hamburger menu isn't pushed out of the overflow-hidden container on mobile
  const paddingX = useTransform(smoothScroll, [0, 80], [20, 16], easeConfig);

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
  const highlightOpacity = useTransform(
    smoothScroll,
    [40, 80],
    [0, 0.3],
    easeConfig,
  );
  const dotOpacity = useTransform(
    smoothScroll,
    [40, 80],
    [0, 0.15],
    easeConfig,
  );
  const staticInsetOpacity = useTransform(
    smoothScroll,
    [0, 80],
    [0, 0.05],
    easeConfig,
  );

  const background = useMotionTemplate`rgba(var(--nav-bg, 15 23 42) / ${bgOpacity})`;
  const boxShadow = useMotionTemplate`
    0 10px 10px rgba(0 0 0 / ${shadowOpacity}),
    inset 0 1px 1px rgba(255 255 255 / ${highlightOpacity}),
    inset 0 0 0 1px rgba(255 255 255 / ${staticInsetOpacity})
  `;
  const border = useMotionTemplate`1px solid rgba(var(--nav-border, 71 85 105) / ${borderOpacity})`;
  const backgroundImage = useMotionTemplate`radial-gradient(circle, rgba(255, 255, 255, ${dotOpacity}) 1px, transparent 1px)`;

  return (
    <>
      <TargetCursor
        spinDuration={2}
        hideDefaultCursor
        parallaxOn
        hoverDuration={0.2}
      />

      {/* FIX 2: Removed pointer-events-none from this wrapper */}
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center">
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
          className="relative w-[calc(100%-2rem)] flex items-center justify-between dark:border-none will-change-transform overflow-hidden">
          <motion.div
            style={{ opacity: highlightOpacity }}
            className="absolute inset-0 pointer-events-none bg-linear-to-t from-foreground/20 via-primary/10 to-transparent border-t-background border-2 dark:border-none"
          />

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center cursor-target relative z-10 shrink-0 gap-2">
            <VenetianMask className="w-8 h-8 text-primary" />

            <span className="font-bold text-2xl tracking-tight">Clarity</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8 relative z-10">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("#") || link.href.startsWith("/#") ? (
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

          {/* Desktop CTA */}
          <Link
            href="/auth"
            className="hidden md:block cursor-target relative z-10 shrink-0">
            <button className="h-9 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
              Try Clarity
            </button>
          </Link>

          {/* Mobile: CTA + hamburger */}
          <div className="flex md:hidden items-center gap-3 relative z-10 shrink-0">
            <Link href="/auth" className="cursor-target">
              <button className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer">
                Try Clarity
              </button>
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </motion.nav>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ top }}
              className="absolute w-[calc(100%-2rem)] max-w-180">
              <div className="mt-16 rounded-2xl border border-border/40 backdrop-blur-3xl shadow-lg overflow-hidden">
                <div className="flex flex-col py-2">
                  {NAV_LINKS.map((link) =>
                    link.href.startsWith("#") || link.href.startsWith("/#") ? (
                      <a
                        key={link.label}
                        href={link.href}
                        onClick={handleHashClick}
                        className="px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
