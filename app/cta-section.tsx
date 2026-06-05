import { BlurFade } from "@/components/ui/blur-fade";
import Link from "next/link";
import React from "react";

const CTASection = () => {
  return (
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
              Join students already improving their learning efficiency with AI.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/auth">
                <button className="h-12 px-8 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/85 transition-colors cursor-pointer">
                  Get started free
                </button>
              </Link>
            </div>
          </div>
        </div>
      </BlurFade>
    </section>
  );
};

export default CTASection;
