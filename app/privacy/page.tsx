"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import Footer from "../footer";

const LAST_UPDATED = "June 1, 2025";
const APP_NAME = "Clarity";
const CONTACT_EMAIL = "tanishenigma@proton.me";

type Section = {
  title: string;
  content: (string | { type: "list"; items: string[] })[];
};

const sections: Section[] = [
  {
    title: "1. Overview",
    content: [
      `${APP_NAME} is built with a strong respect for your privacy. We collect the minimum data necessary to run the platform, your files never leave your device, and we do not sell or share your personal information with third parties for commercial purposes.`,
      "This policy explains exactly what we collect, why, and how it is handled.",
    ],
  },
  {
    title: "2. What We Collect",
    content: [
      "When you create an account, we store the following in our database:",
      {
        type: "list",
        items: [
          "Your email address — used for authentication and account recovery.",
          "A hashed (one-way encrypted) version of your password — we never store your password in plain text.",
          "Your display name, if you choose to set one.",
          "Account metadata: creation date, last login timestamp.",
        ],
      },
      "We do not collect payment information, phone numbers, or any other personal identifiers beyond what is listed above.",
    ],
  },
  {
    title: "3. Your Files Stay Local",
    content: [
      `${APP_NAME} processes study material — PDFs, notes, and documents — directly in your browser or on your local device. This content is never uploaded to our servers.`,
      "Specifically:",
      {
        type: "list",
        items: [
          "Files you upload are read and processed in-memory on your device.",
          "Flashcards and quiz data generated from your files are stored in your browser's local storage.",
          "Clearing your browser data will delete this local content — we cannot restore it.",
          "No employee or system at Clarity ever has access to your study material.",
        ],
      },
    ],
  },
  {
    title: "4. How We Use Your Data",
    content: [
      "We use the data we collect solely for the following purposes:",
      {
        type: "list",
        items: [
          "Authenticating you when you sign in.",
          "Sending account-related emails (password reset, security alerts).",
          "Maintaining your account and providing customer support if you contact us.",
          "Aggregated, anonymized analytics to understand how features are used (e.g., how many users create flashcards) — this data cannot be traced back to you.",
        ],
      },
      "We do not use your data to train AI models. We do not profile you for advertising.",
    ],
  },
  {
    title: "5. Data Storage and Security",
    content: [
      "Account data is stored in a MongoDB database with the following protections:",
      {
        type: "list",
        items: [
          "Passwords are hashed with bcrypt before storage.",
          "Database access is restricted to authenticated backend services only.",
          "All data in transit is encrypted via TLS/HTTPS.",
          "We follow the principle of least privilege — only code that needs access to your data has it.",
        ],
      },
      "No security system is perfect. In the event of a data breach affecting your account, we will notify you by email as soon as reasonably possible.",
    ],
  },
  {
    title: "6. Third-Party Services",
    content: [
      "We use a small number of third-party services to operate the platform:",
      {
        type: "list",
        items: [
          "MongoDB Atlas — cloud database hosting for account data. Subject to MongoDB's privacy policy.",
          "Email delivery provider — used only to send transactional emails (password reset, etc.).",
        ],
      },
      "These providers act as data processors on our behalf and are contractually prohibited from using your data for their own purposes.",
      "We do not integrate with advertising networks, social media trackers, or analytics platforms that identify individual users.",
    ],
  },
  {
    title: "7. Cookies and Local Storage",
    content: [
      "We use cookies strictly for session management — to keep you logged in between visits. We do not use tracking cookies or third-party cookies.",
      "Browser local storage is used to persist your study data (flashcards, quiz history, settings) on your device. You can clear this at any time via your browser settings.",
    ],
  },
  {
    title: "8. Your Rights",
    content: [
      "You have the following rights regarding your data:",
      {
        type: "list",
        items: [
          "Access: You can request a copy of all account data we hold about you.",
          "Correction: You can update your email or display name from account settings.",
          "Deletion: You can permanently delete your account and all associated database records from account settings at any time.",
          "Portability: You can export your locally stored study data (flashcards, quizzes) from within the app.",
        ],
      },
      `To exercise any of these rights or ask questions, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: "9. Data Retention",
    content: [
      "We retain your account data for as long as your account is active. If you delete your account:",
      {
        type: "list",
        items: [
          "Your email, display name, and hashed password are permanently deleted from our database within 30 days.",
          "Aggregated, anonymized usage statistics that cannot identify you may be retained for product analytics.",
          "Local study data is cleared when you clear your browser storage or uninstall the app.",
        ],
      },
    ],
  },
  {
    title: "10. Children's Privacy",
    content: [
      `${APP_NAME} is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child under 13 has created an account, please contact us at ${CONTACT_EMAIL} and we will delete the account promptly.`,
    ],
  },
  {
    title: "11. Changes to This Policy",
    content: [
      "We may update this Privacy Policy to reflect changes to our practices or legal requirements. We will notify you of material changes via email or an in-app notice at least 7 days before they take effect. The updated policy will always be available at this page.",
    ],
  },
  {
    title: "12. Contact Us",
    content: [
      `If you have any questions, concerns, or requests regarding this Privacy Policy, please reach out at ${CONTACT_EMAIL}. We aim to respond within 2 business days.`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[45%] h-[45%] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative z-50">
        <Navbar />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pt-36 pb-24">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated:{" "}
            <span className="text-foreground/70 font-medium">
              {LAST_UPDATED}
            </span>
          </p>
          <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-medium">TL;DR:</strong> We
            only store your email and hashed password. Your files never leave
            your device. We don't sell your data, run ads, or train AI on your
            content.
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.content.map((block, i) =>
                  typeof block === "string" ? (
                    <p
                      key={i}
                      className="text-sm text-muted-foreground leading-relaxed">
                      {block}
                    </p>
                  ) : (
                    <ul key={i} className="space-y-1.5 ml-4">
                      {block.items.map((item, j) => (
                        <li
                          key={j}
                          className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                          <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-primary/60" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
              <div className="mt-8 h-px bg-border/50" />
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-14 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Questions?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
          </p>
          <Link
            href="/terms"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
