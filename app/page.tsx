"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ReactLenis } from "lenis/react";
import { motion } from "framer-motion";
import RotatingText from "@/components/ui/rotating-text";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLenis } from "lenis/react";

import { Navbar } from "@/components/layout/navbar";
import Image from "next/image";
import spaceImage from "@/public/image.png";
import spaceImageDark from "@/public/image_dark.png";
import logoLight from "@/public/logo_light.png";
import logoDark from "@/public/logo_dark.png";
import { useEffect } from "react";

const ContainerScroll = dynamic(
  () =>
    import("@/components/ui/container-scroll-animation").then(
      (module) => module.ContainerScroll,
    ),
  {
    ssr: false,
  },
);

const MagicBento = dynamic(() => import("@/components/MagicBento"), {
  ssr: false,
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BlurFade = ({
  children,
  className,
  delay = 0,
  yOffset = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: yOffset, filter: "blur(12px)" }}
    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.9, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    className={cn("w-full", className)}>
    {children}
  </motion.div>
);

export default function LandingPage() {
  const lenis = useLenis();
  const year = new Date().getFullYear();
  useEffect(() => {
    if (!lenis) return;

    const t = setTimeout(() => lenis.resize(), 500);
    return () => clearTimeout(t);
  }, [lenis]);
  return (
    <ReactLenis root options={{ lerp: 0.4, duration: 2.5, smoothWheel: true }}>
      <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
        {/* Background blobs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[45%] h-[45%] rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[80px]" />
        </div>
        <div className="relative z-50">
          <Navbar />
        </div>

        {/* Hero */}
        <section className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-36 pb-28 lg:pt-52 lg:pb-40">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
              The only learning app
              <br />
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                you&apos;ll ever{" "}
                <RotatingText
                  texts={["need", "want", "love", "use"]}
                  mainClassName="px-2 md:px-4 bg-primary/15 text-primary overflow-hidden py-1 md:py-2 rounded-xl whitespace-nowrap"
                  staggerFrom="last"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-120%" }}
                  staggerDuration={0.015}
                  splitLevelClassName="overflow-hidden pb-1"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={3000}
                />
              </span>
            </h1>
          </div>

          <div className="max-w-2xl mx-auto mt-7">
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              AI-powered tutoring, smart flashcards, and personalized quizzes —
              all in one place.
            </p>
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/auth">
              <button className="h-12 px-7 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/85 transition-colors">
                Get started free
              </button>
            </Link>
            <Link href="#features">
              <button className="h-12 px-7 rounded-full border border-border text-sm font-medium text-foreground/80 hover:bg-muted transition-colors">
                See how it works
              </button>
            </Link>
          </div>
        </section>

        {/* Study smarter — desktop uses ContainerScroll, mobile renders flat */}
        <section className="relative z-10 px-4">
          {/* ── Mobile (< md) ── */}
          <div className="md:hidden py-16 space-y-8 max-w-xl mx-auto text-center">
            <BlurFade>
              <h2 className="text-4xl font-bold leading-tight">
                Study smarter,
                <br />
                <span className="text-primary">not harder.</span>
              </h2>
            </BlurFade>
            <BlurFade delay={0.15}>
              <div className="relative rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.4),0_0_80px_-20px_rgba(120,119,198,0.2)]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(120,119,198,0.12),transparent_70%)] z-10 pointer-events-none" />
                <Image
                  src={spaceImage}
                  alt="Study space"
                  width={800}
                  height={500}
                  sizes="(max-width: 768px) 100vw, 800px"
                  quality={65}
                  className="w-full h-auto object-cover dark:hidden"
                  priority
                />
                <Image
                  src={spaceImageDark}
                  alt="Study space"
                  width={800}
                  height={500}
                  sizes="(max-width: 768px) 100vw, 800px"
                  quality={65}
                  className="w-full h-auto object-cover dark:block hidden"
                />
              </div>
            </BlurFade>
          </div>

          {/* ── Desktop (≥ md) ── */}
          <div className="hidden md:block py-28">
            <div className="max-w-6xl mx-auto">
              <BlurFade delay={0.5} className="space-y-6">
                <ContainerScroll
                  titleComponent={
                    <h2 className="text-4xl md:text-6xl font-bold leading-tight">
                      Study smarter,
                      <br />
                      <span className="text-primary">not harder.</span>
                    </h2>
                  }>
                  <div className="relative  overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(120,119,198,0.12),transparent_70%)] z-10 pointer-events-none " />
                    <Image
                      src={spaceImage}
                      alt="Study space"
                      width={800}
                      height={500}
                      sizes="(max-width: 1280px) 100vw, 800px"
                      quality={65}
                      className="w-full object-cover dark:hidden"
                    />

                    <Image
                      src={spaceImageDark}
                      alt="Study space"
                      width={800}
                      height={500}
                      sizes="(max-width: 1280px) 100vw, 800px"
                      quality={65}
                      className="w-full h-auto object-cover dark:block hidden"
                    />
                  </div>
                </ContainerScroll>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="relative z-10 py-28 px-4 grid items-center justify-center">
          <div className="max-w-6xl mx-auto">
            <BlurFade className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold">
                Everything to <span className="text-primary">excel</span>
              </h2>
              <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
                Comprehensive tools built for the way you actually study.
              </p>
            </BlurFade>
            <BlurFade>
              <MagicBento
                textAutoHide={true}
                enableStars
                enableSpotlight={true}
                enableBorderGlow={false}
                enableTilt={false}
                enableMagnetism
                clickEffect
                spotlightRadius={160}
                particleCount={25}
                disableAnimations={false}
              />
            </BlurFade>
          </div>
        </section>

        {/* CTA */}
        <section className="relative z-10 py-28 px-4">
          <BlurFade>
            <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden bg-card/30 backdrop-blur-2xl border border-border/50 px-8 py-24 text-center shadow-2xl">
              <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light pointer-events-none" />
              <div className="relative z-10 space-y-5">
                <h2 className="text-4xl md:text-6xl font-bold">
                  Ready to transform
                  <br />
                  your grades?
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  Join students already improving their learning efficiency with
                  AI.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link href="/auth">
                    <button className="h-12 px-8 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/85 transition-colors">
                      Get started free
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </BlurFade>
        </section>

        {/* Footer */}
        <footer className="relative z-10 py-10 border-t border-border/30">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image
                src={logoLight}
                alt="Clarity"
                width={84}
                height={20}
                sizes="84px"
                className="dark:hidden"
              />
              <Image
                src={logoDark}
                alt="Clarity"
                width={84}
                height={20}
                sizes="84px"
                className="hidden dark:block"
              />
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link
                href="#"
                className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link
                href="#"
                className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link
                href="#"
                className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              © {year} Clarity.
            </div>
          </div>
        </footer>
      </div>
    </ReactLenis>
  );
}
