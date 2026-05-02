"use client";

import React from "react";
import katex from "katex";

interface LatexRendererProps {
  children: string;
  className?: string;
}

export function LatexRenderer({ children, className }: LatexRendererProps) {
  const segments = parseLatex(children);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <React.Fragment key={i}>{seg.content}</React.Fragment>;
        }

        try {
          const html = katex.renderToString(seg.content, {
            displayMode: seg.type === "block",
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={i}
              className={
                seg.type === "block" ? "block my-2 overflow-x-auto" : "inline"
              }
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={i}>{seg.raw}</span>;
        }
      })}
    </span>
  );
}

type Segment =
  | { type: "text"; content: string }
  | { type: "inline" | "block"; content: string; raw: string };

function parseLatex(input: string): Segment[] {
  const segments: Segment[] = [];
  // Order matters: block patterns first so they don't get split by inline pattern
  // \(...\) uses [\s\S]+? so nested parens like (p\|q) don't break the match
  const pattern =
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: input.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    let type: "inline" | "block";
    let content: string;

    if (raw.startsWith("$$") && raw.endsWith("$$")) {
      type = "block";
      content = raw.slice(2, -2).trim();
    } else if (raw.startsWith("\\[") && raw.endsWith("\\]")) {
      type = "block";
      content = raw.slice(2, -2).trim();
    } else if (raw.startsWith("\\(") && raw.endsWith("\\)")) {
      type = "inline";
      content = raw.slice(2, -2).trim();
    } else {
      // $...$
      type = "inline";
      content = raw.slice(1, -1).trim();
    }

    segments.push({ type, content, raw });
    lastIndex = match.index + raw.length;
  }

  // Remaining plain text
  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }

  return segments;
}
