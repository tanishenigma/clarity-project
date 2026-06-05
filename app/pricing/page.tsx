"use client";

import Link from "next/link";
import { ReactLenis } from "lenis/react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Navbar } from "@/components/layout/navbar";
import Footer from "../footer";

const CHECK_ICON = (
  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
    <svg
      className="w-2.5 h-2.5 stroke-primary fill-none stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 12 12">
      <polyline points="2,6 5,9 10,3" />
    </svg>
  </span>
);

export default function PricingPage() {
  return (
    <ReactLenis root options={{ lerp: 0.4, duration: 2.5, smoothWheel: true }}>
      <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
        {/* Background blobs — matched from landing page */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[5%] w-[45%] h-[45%] rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[80px]" />
        </div>

        <div className="relative z-50">
          <Navbar />
        </div>

        {/* Hero */}
        <section className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-36 pb-16 lg:pt-52 lg:pb-20">
          <BlurFade delay={0.1}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-3xl mx-auto">
              Local is the future.{" "}
              <span className="text-primary">Free is the standard.</span>
            </h1>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
              No subscriptions. No paywalls. No hidden fees. Great learning
              tools should be accessible to everyone — always.
            </p>
          </BlurFade>
        </section>

        {/* Pricing cards */}
        <section className="relative z-10 px-4 pb-20 max-w-4xl mx-auto">
          <BlurFade delay={0.3}>
            {/* Updated flex container to center the single card */}
            <div className="flex justify-center w-full">
              {/* Added max-w-sm to control the card width */}
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 flex flex-col items-center">
                <span className="text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-primary/10 text-primary w-fit mb-4">
                  Community
                </span>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    $0
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">
                    /mo
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed text-center">
                  Everything you need to learn smarter — completely free,
                  forever.
                </p>
                <hr className="w-full border-border mb-5" />
                <ul className="flex flex-col gap-2.5 mb-8 w-full">
                  {[
                    "AI-powered tutoring",
                    "Smart flashcards",
                    "Personalized quizzes",
                    "Local data, full privacy",
                    "Community access",
                  ].map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      {CHECK_ICON}
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth" className="w-full mt-auto">
                  <button className="w-full h-11 rounded-full border border-border text-sm font-semibold hover:bg-muted transition-colors cursor-pointer">
                    Get started free
                  </button>
                </Link>
              </div>
            </div>
          </BlurFade>

          {/* Manifesto cards */}
          <BlurFade delay={0.4}>
            <div className="grid sm:grid-cols-2 gap-4 mt-40">
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-4 h-4 stroke-primary fill-none stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                    viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-base mb-2">
                  Designed for you
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your data stays local, private, and entirely under your
                  control. No tracking, no selling, no compromises.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-border bg-card">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-4 h-4 stroke-primary fill-none stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                    viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-base mb-2">Open access</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We believe in democratizing powerful tools. Access everything
                  we build — no paywall, no gated tiers.
                </p>
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={0.5}>
            <p className="text-center text-sm italic text-muted-foreground/70 mt-10">
              Join the movement. Start building today.
            </p>
          </BlurFade>
        </section>

        <Footer />
      </div>
    </ReactLenis>
  );
}
