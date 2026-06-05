"use client";

import { useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const faqs = [
  {
    question: "How does the AI tutoring actually work?",
    answer:
      "Our AI tutor uses a multi-agent architecture — a supervisor routes your questions to specialized agents that can explain concepts, generate practice problems, plot graphs, and assess your understanding. It's not just a chatbot; it's a full learning system.",
  },
  {
    question: "Can I upload my own study material?",
    answer:
      "Yes. You can upload PDFs, notes, or paste text directly. Clarity will index your material and let you query it, generate flashcards from it, or create quizzes based on it — all within seconds.",
  },

  {
    question: "Is Clarity free to use?",
    answer:
      "Clarity offers a free tier with generous limits for individual learners. Premium plans unlock unlimited AI tutoring sessions, advanced quiz analytics, and priority processing. No credit card required to start.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Your notes and study material are encrypted at rest and never used to train our models. We follow industry-standard data practices and you can delete your data at any time from your account settings.",
  },
  {
    question: "Can I use Clarity on mobile?",
    answer:
      "Yes — Clarity is fully responsive and works great on phones and tablets. A dedicated mobile app is on the roadmap for later this year.",
  },
];

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <BlurFade delay={0.05 * index}>
      <div
        className={cn(
          "border border-border rounded-2xl overflow-hidden transition-colors duration-200",
          open ? "bg-muted/40" : "bg-transparent hover:bg-muted/20",
        )}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 cursor-pointer"
          aria-expanded={open}>
          <span className="text-base font-medium text-foreground leading-snug">
            {question}
          </span>
          <span
            className={cn(
              "shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-border text-foreground/60 transition-transform duration-300",
              open && "rotate-45",
            )}
            aria-hidden>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 1V11M1 6H11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>

        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}>
          <div className="overflow-hidden">
            <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </BlurFade>
  );
}

export default function FAQSection() {
  return (
    <section id="faq" className="relative z-10 px-4 py-24 lg:py-36">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <BlurFade className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Frequently Asked <span className="text-primary">Questions.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg leading-relaxed">
            Everything you need to know before you start learning smarter.
          </p>
        </BlurFade>

        {/* Accordion list */}
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} index={i} {...faq} />
          ))}
        </div>

        {/* Bottom CTA */}
        <BlurFade delay={0.5} className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Still have questions?{" "}
            <a
              href="mailto:tanishenigma@proton.me"
              className="text-primary font-medium hover:underline underline-offset-4 transition-all">
              Reach out
            </a>
          </p>
        </BlurFade>
      </div>
    </section>
  );
}
