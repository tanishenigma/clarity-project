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
    title: "1. Acceptance of Terms",
    content: [
      `By creating an account or using ${APP_NAME}, you agree to these Terms of Service. If you do not agree, please do not use the platform. These terms apply to all users, including visitors, registered users, and anyone accessing the service.`,
    ],
  },
  {
    title: "2. Your Account",
    content: [
      `To use ${APP_NAME}, you create an account using your email address. Account credentials and basic profile information are stored securely in our database. You are responsible for:`,
      {
        type: "list",
        items: [
          "Keeping your login credentials confidential.",
          "All activity that occurs under your account.",
          "Notifying us immediately at " +
            CONTACT_EMAIL +
            " if you suspect unauthorized access.",
        ],
      },
      "We do not allow account sharing. Each account must represent a single individual.",
    ],
  },
  {
    title: "3. Your Files and Study Content",
    content: [
      `${APP_NAME} is designed with a local-first philosophy. Any files you upload — including PDFs, notes, and documents — are processed and stored locally on your device. We do not upload, retain, or store your files on our servers.`,
      "This means:",
      {
        type: "list",
        items: [
          "Your study material never leaves your device unless you explicitly share it.",
          "Clearing your browser data or local storage will remove your files from the app.",
          "We cannot recover files you have deleted locally.",
          "File content is not accessible to Clarity staff or third parties.",
        ],
      },
    ],
  },
  {
    title: "4. Acceptable Use",
    content: [
      "You agree to use Clarity only for lawful, personal educational purposes. You must not:",
      {
        type: "list",
        items: [
          "Attempt to reverse-engineer, scrape, or copy the platform or its AI models.",
          "Use the service to generate, distribute, or store harmful, illegal, or misleading content.",
          "Circumvent any technical limitations or access controls.",
          "Use automated tools, bots, or scripts to interact with the service.",
          "Impersonate another person or misrepresent your identity.",
        ],
      },
    ],
  },
  {
    title: "5. Intellectual Property",
    content: [
      `The ${APP_NAME} platform, including its interface, AI models, and underlying code, is owned by us and protected by applicable intellectual property laws. You retain full ownership of any content you create or upload.`,
      "We do not claim any rights over your study notes, flashcards, or quiz responses.",
    ],
  },
  {
    title: "6. AI-Generated Content",
    content: [
      `${APP_NAME} uses AI to generate explanations, flashcards, and quiz questions. While we strive for accuracy, AI-generated content may occasionally be incomplete or incorrect. You should:`,
      {
        type: "list",
        items: [
          "Verify important information with authoritative sources.",
          "Not rely solely on Clarity for high-stakes academic decisions.",
          "Report inaccurate AI responses via the feedback tool so we can improve.",
        ],
      },
    ],
  },
  {
    title: "7. Service Availability",
    content: [
      "We aim to keep Clarity available at all times, but we do not guarantee uninterrupted access. We may perform maintenance, push updates, or temporarily suspend the service without notice. We are not liable for any losses resulting from downtime.",
    ],
  },
  {
    title: "8. Termination",
    content: [
      "You may delete your account at any time from your account settings. Upon deletion, your account data stored in our database will be permanently removed.",
      "We reserve the right to suspend or terminate accounts that violate these terms, without prior notice.",
    ],
  },
  {
    title: "9. Disclaimer of Warranties",
    content: [
      `${APP_NAME} is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be error-free, uninterrupted, or suitable for any particular purpose.`,
    ],
  },
  {
    title: "10. Limitation of Liability",
    content: [
      "To the fullest extent permitted by law, Clarity and its team shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.",
    ],
  },
  {
    title: "11. Changes to These Terms",
    content: [
      "We may update these Terms of Service from time to time. We will notify you of significant changes via email or an in-app notice. Continued use of the platform after changes take effect constitutes acceptance of the new terms.",
    ],
  },
  {
    title: "12. Contact",
    content: [
      `For questions about these terms, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
];

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated:{" "}
            <span className="text-foreground/70 font-medium">
              {LAST_UPDATED}
            </span>
          </p>
          <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
            Please read these terms carefully before using {APP_NAME}. They
            govern your use of the platform and outline our respective rights
            and responsibilities.
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
            href="/privacy"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
