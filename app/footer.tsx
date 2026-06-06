import React from "react";
import logoLight from "@/public/logo_light.png";
import logoDark from "@/public/logo_dark.png";
import Link from "next/link";
import Image from "next/image";
import { Github, VenetianMask } from "lucide-react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      id="footer"
      className="relative z-10 py-10 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4">
        {/* Desktop: single row — Logo | GitHub | Legal + Copyright */}
        <div className="hidden md:grid md:grid-cols-3 items-center gap-4">
          {/* Left: Logo */}
          <div className="flex justify-start">
            <Link
              href="/"
              className="flex items-center cursor-pointer relative z-10 shrink-0 gap-2">
              <VenetianMask className="w-8 h-8 text-primary" />

              <span className="font-bold text-2xl tracking-tight">Clarity</span>
            </Link>
          </div>

          {/* Center: GitHub */}
          <div className="flex justify-center">
            <Link
              href="https://github.com/tanishenigma"
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <div className="p-1 rounded-full bg-primary/15 text-primary">
                <Github size={16} />
              </div>
              <span>tanishenigma</span>
            </Link>
          </div>

          {/* Right: Legal + Copyright */}
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span className="text-border">·</span>
            <span>©{year} Clarity.</span>
          </div>
        </div>

        {/* Mobile: stacked — Logo → GitHub → Legal → Copyright */}
        <div className="flex md:hidden flex-col items-center gap-5">
          {/* Logo */}
          <div>
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

          {/* GitHub */}
          <Link
            href="https://github.com/tanishenigma"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <div className="p-1 rounded-full bg-primary/10 text-primary">
              <Github size={16} />
            </div>
            <span>tanishenigma</span>
          </Link>

          {/* Legal links */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </div>

          {/* Copyright — always last on mobile */}
          <p className="text-xs text-muted-foreground">©{year} Clarity.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
