"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "react-pdf/dist/Page/TextLayer.css";
// @ts-ignore
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  X,
  Quote,
  Loader2,
  MessageSquarePlus,
  ZoomIn,
  ZoomOut,
  Bookmark,
  BookmarkCheck,
  Copy,
  Layers,
  Sparkles,
  Brain,
  FlipHorizontal,
  Moon,
  Sun,
  Check,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AskMode = "ask" | "explain" | "summarize" | "flashcard" | "quiz";

export interface DocBookmark {
  id: string;
  pageNum: number;
  label: string;
  createdAt: number;
}

export interface PdfPanelProps {
  url: string;
  title: string;
  onClose: () => void;
  /** Called whenever the user triggers an AI action from the PDF */
  onAskAI: (text: string, mode?: AskMode) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];

type SidePanel = "none" | "thumbnails" | "bookmarks";
type ReadingMode = "default" | "sepia" | "dark";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PdfPanel({ url, title, onClose, onAskAI }: PdfPanelProps) {
  // ── Core state ──────────────────────────────────────────────────────────
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);

  // ── Feature state ────────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<DocBookmark[]>([]);
  const [activePanel, setActivePanel] = useState<SidePanel>("none");
  const [readingMode, setReadingMode] = useState<ReadingMode>("default");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Jump to page ─────────────────────────────────────────────────────────
  const [jumpFocus, setJumpFocus] = useState(false);
  const [jumpVal, setJumpVal] = useState("");

  // ── Selection popup ──────────────────────────────────────────────────────
  const [popup, setPopup] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Derived
  const pageWidth = useMemo(
    () => Math.max(300, baseWidth * zoom),
    [baseWidth, zoom],
  );

  // ── Responsive width ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setBaseWidth(Math.max(300, entry.contentRect.width - 48));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Scroll progress ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setScrollProgress(max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll spy ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best?.isIntersecting) {
          const idx = pageRefs.current.indexOf(best.target as HTMLDivElement);
          if (idx !== -1) setActivePage(idx + 1);
        }
      },
      { root: containerRef.current, threshold: [0.3, 0.6] },
    );
    pageRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [numPages]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        setPopup(null);
        setJumpFocus(false);
        return;
      }
      if (isInput) return;
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetZoom();
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        scrollToPage(Math.min(numPages, activePage + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        scrollToPage(Math.max(1, activePage - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, numPages]);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomIn = useCallback(
    () => setZoom((z) => ZOOM_STEPS.find((l) => l > z) ?? z),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => [...ZOOM_STEPS].reverse().find((l) => l < z) ?? z),
    [],
  );
  const resetZoom = useCallback(() => setZoom(1), []);

  // ── Scroll to page ───────────────────────────────────────────────────────
  const scrollToPage = useCallback((n: number) => {
    pageRefs.current[n - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // ── Selection → popup ────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || !containerRef.current) {
      setPopup(null);
      return;
    }
    const anchor = sel?.anchorNode;
    if (!anchor || !containerRef.current.contains(anchor as Node)) {
      setPopup(null);
      return;
    }

    const rect = sel!.getRangeAt(0).getBoundingClientRect();
    setPopup({ text, x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  // ── Dismiss popup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!popup) return;
    const dismiss = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-pdf-popup]")) setPopup(null);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [popup]);

  // ── Bookmarks ────────────────────────────────────────────────────────────
  const isBookmarked = useCallback(
    (n: number) => bookmarks.some((b) => b.pageNum === n),
    [bookmarks],
  );

  const toggleBookmark = useCallback((n: number) => {
    setBookmarks((bms) => {
      const idx = bms.findIndex((b) => b.pageNum === n);
      if (idx !== -1) return bms.filter((_, i) => i !== idx);
      return [
        ...bms,
        {
          id: `b-${Date.now()}`,
          pageNum: n,
          label: `Page ${n}`,
          createdAt: Date.now(),
        },
      ];
    });
  }, []);

  // ── Copy ─────────────────────────────────────────────────────────────────
  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // ── Jump to page ─────────────────────────────────────────────────────────
  const commitJump = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const n = parseInt(jumpVal, 10);
      if (!isNaN(n) && n >= 1 && n <= numPages) {
        scrollToPage(n);
        setJumpVal("");
        setJumpFocus(false);
      }
    }
    if (e.key === "Escape") {
      setJumpFocus(false);
      setJumpVal("");
    }
  };

  // ── Reading mode filter ──────────────────────────────────────────────────
  const bgByMode = {
    default: "bg-zinc-100 dark:bg-zinc-900",
    sepia: "bg-[#f5ead5]",
    dark: "bg-zinc-950",
  }[readingMode];

  const filterByMode = {
    default: "none",
    sepia: "sepia(0.45) contrast(0.93) brightness(0.99)",
    dark: "invert(1) hue-rotate(180deg) brightness(0.9)",
  }[readingMode];

  // ── Panel toggle helper ──────────────────────────────────────────────────
  const togglePanel = (p: SidePanel) =>
    setActivePanel((cur) => (cur === p ? "none" : p));

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col min-w-0 flex-1 overflow-hidden bg-background select-text font-sans">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
        {/* Left: panel toggles */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Btn
            tip="Page thumbnails"
            active={activePanel === "thumbnails"}
            onClick={() => togglePanel("thumbnails")}>
            <Layers className="h-3.5 w-3.5" />
          </Btn>
          <Btn
            tip="Bookmarks"
            active={activePanel === "bookmarks"}
            onClick={() => togglePanel("bookmarks")}>
            <Bookmark className="h-3.5 w-3.5" />
            {bookmarks.length > 0 && (
              <span className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 text-[8px] bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                {bookmarks.length}
              </span>
            )}
          </Btn>
        </div>

        <Divider />

        {/* Center: title */}
        <span
          className="text-xs font-semibold text-foreground truncate flex-1 min-w-0"
          title={title}>
          {title}
        </span>

        {/* Right: controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Zoom */}
          <Btn tip="Zoom out (−)" onClick={zoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Btn>
          <button
            onClick={resetZoom}
            title="Reset zoom (0)"
            className="w-9 text-center text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors tabular-nums">
            {Math.round(zoom * 100)}%
          </button>
          <Btn tip="Zoom in (+)" onClick={zoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Btn>

          <Divider />

          {/* Page indicator */}
          {numPages > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              {jumpFocus ? (
                <input
                  autoFocus
                  value={jumpVal}
                  onChange={(e) => setJumpVal(e.target.value)}
                  onKeyDown={commitJump}
                  onBlur={() => {
                    setJumpFocus(false);
                    setJumpVal("");
                  }}
                  placeholder={String(activePage)}
                  className="w-9 text-center text-xs rounded bg-muted outline-none border border-primary/50 py-0.5 tabular-nums"
                />
              ) : (
                <button
                  onClick={() => setJumpFocus(true)}
                  title="Click to jump to page"
                  className="hover:text-primary transition-colors font-semibold">
                  {activePage}
                </button>
              )}
              <span className="opacity-50">/</span>
              <span>{numPages}</span>
            </div>
          )}

          <Divider />

          {/* Reading mode cycle */}
          <Btn
            tip={`Reading mode: ${readingMode} (click to cycle)`}
            onClick={() =>
              setReadingMode((m) =>
                m === "default" ? "sepia" : m === "sepia" ? "dark" : "default",
              )
            }>
            {readingMode === "dark" ? (
              <Moon className="h-3.5 w-3.5" />
            ) : readingMode === "sepia" ? (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
          </Btn>

          <Divider />

          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors "
            aria-label="Close">
            <span>Close</span>
            <X className="h-5 w-5 text-muted-foreground " />
          </button>
        </div>
      </div>

      {/* ── Main body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        {activePanel !== "none" && (
          <aside className="w-52 shrink-0 min-h-0 border-r border-border overflow-y-auto flex flex-col bg-muted/20 animate-in slide-in-from-left-2 duration-150">
            {/* Thumbnails */}
            {activePanel === "thumbnails" && (
              <div className="p-2 flex flex-col gap-2">
                <SectionLabel>Pages</SectionLabel>
                {numPages > 0 &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => scrollToPage(n)}
                      title={`Jump to page ${n}`}
                      className={`group relative rounded-md overflow-hidden border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        activePage === n
                          ? "border-primary shadow-sm shadow-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}>
                      <Document file={url}>
                        <Page
                          pageNumber={n}
                          width={180}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="pointer-events-none"
                        />
                      </Document>
                      {/* Overlay */}
                      <div
                        className={`absolute inset-0 flex items-end px-1.5 pb-1.5 bg-linear-to-t from-black/50 via-transparent to-transparent transition-opacity ${
                          activePage === n
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}>
                        <span className="text-[9px] font-medium text-white">
                          {n}
                        </span>
                      </div>
                      {/* Bookmark badge */}
                      {isBookmarked(n) && (
                        <div className="absolute top-1 right-1 drop-shadow">
                          <Bookmark className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )}

            {/* Bookmarks */}
            {activePanel === "bookmarks" && (
              <div className="p-2 flex flex-col gap-1.5">
                <SectionLabel>Bookmarks ({bookmarks.length})</SectionLabel>
                {bookmarks.length === 0 ? (
                  <EmptyState
                    icon={<Bookmark className="h-5 w-5" />}
                    text="No bookmarks yet. Hover a page and click the bookmark icon."
                  />
                ) : (
                  [...bookmarks]
                    .sort((a, b) => a.pageNum - b.pageNum)
                    .map((bm) => (
                      <button
                        key={bm.id}
                        onClick={() => scrollToPage(bm.pageNum)}
                        className="group flex items-center gap-2 rounded-md px-2 py-1.5 bg-background/80 hover:bg-background border border-border/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Bookmark className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                        <span className="flex-1 text-[11px] font-medium text-foreground truncate">
                          {bm.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookmarks((bms) =>
                              bms.filter((b) => b.id !== bm.id),
                            );
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                          title="Remove bookmark">
                          <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </button>
                    ))
                )}
              </div>
            )}
          </aside>
        )}

        {/* ── PDF viewer + scrubber ─────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Right-side page scrubber */}
          {numPages > 1 && (
            <div className="absolute right-0 top-0 bottom-0 w-5 z-10 flex flex-col items-center py-2 select-none bg-background/70 backdrop-blur-sm border-l border-border/30">
              <div className="relative flex-1 w-1 rounded-full bg-muted/50 mx-auto overflow-visible">
                {/* Progress fill */}
                <div
                  className="absolute left-0 right-0 top-0 rounded-full bg-primary/25 transition-all duration-100"
                  style={{ height: `${scrollProgress * 100}%` }}
                />
                {/* Page ticks */}
                {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    title={`Page ${n}`}
                    onClick={() => scrollToPage(n)}
                    style={{
                      top: `${((n - 1) / Math.max(1, numPages - 1)) * 100}%`,
                    }}
                    className={`absolute -translate-y-1/2 left-1/2 -translate-x-1/2 rounded-full transition-all hover:scale-150 ${
                      activePage === n
                        ? "w-2.5 h-2.5 bg-primary shadow-sm shadow-primary/40"
                        : "w-1.5 h-1.5 bg-muted-foreground/40 hover:bg-primary/60"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/70 tabular-nums mt-1">
                {activePage}
              </span>
            </div>
          )}

          {/* PDF scroll container */}
          <div
            ref={containerRef}
            onMouseUp={handleMouseUp}
            className={`h-full min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center gap-0 overscroll-contain ${bgByMode}`}
            style={{ paddingRight: numPages > 1 ? "1.25rem" : 0 }}>
            {pageWidth === 0 ? (
              <LoadingState label="Initializing…" />
            ) : (
              <Document
                file={url}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setActivePage(1);
                }}
                loading={<LoadingState label="Loading PDF…" />}
                error={
                  <p className="text-sm text-destructive py-16 text-center px-6">
                    Could not load PDF. The file may be restricted or
                    unavailable.
                  </p>
                }>
                {numPages > 0 &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                    <div
                      key={n}
                      ref={(el) => {
                        pageRefs.current[n - 1] = el;
                      }}
                      className="relative w-full flex flex-col items-center pt-5 pb-2 px-5 group">
                      {/* Per-page toolbar */}
                      <div className="flex items-center justify-between w-full max-w-full mb-1.5 px-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground/50">
                          Page {n}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Bookmark toggle */}
                          <button
                            onClick={() => toggleBookmark(n)}
                            title={
                              isBookmarked(n)
                                ? "Remove bookmark"
                                : "Add bookmark"
                            }
                            className="p-1 rounded-md hover:bg-muted transition-colors">
                            {isBookmarked(n) ? (
                              <BookmarkCheck className="h-3 w-3 text-amber-500" />
                            ) : (
                              <Bookmark className="h-3 w-3 text-muted-foreground hover:text-amber-500" />
                            )}
                          </button>

                          {/* Summarize page */}
                          <PageBtn
                            icon={<Sparkles className="h-3 w-3" />}
                            label="Summarize"
                            onClick={() =>
                              onAskAI(
                                `[Page ${n} of "${title}"] Please summarize the key points on this page.`,
                                "summarize",
                              )
                            }
                          />

                          {/* Quiz me */}
                          <PageBtn
                            icon={<Brain className="h-3 w-3" />}
                            label="Quiz me"
                            onClick={() =>
                              onAskAI(
                                `[Page ${n} of "${title}"] Create 3 quiz questions based on the content on this page.`,
                                "quiz",
                              )
                            }
                          />

                          {/* Ask about page */}
                          <PageBtn
                            icon={<MessageSquarePlus className="h-3 w-3" />}
                            label="Ask"
                            onClick={() =>
                              onAskAI(`[From page ${n} of "${title}"] `)
                            }
                          />
                        </div>
                      </div>

                      {/* Page render */}
                      <div style={{ filter: filterByMode }}>
                        <Page
                          pageNumber={n}
                          width={pageWidth}
                          renderTextLayer
                          renderAnnotationLayer={false}
                          className="shadow-lg rounded-sm overflow-hidden"
                        />
                      </div>

                      {/* Separator */}
                      {n < numPages && (
                        <div className="w-full mt-4 border-b border-border/25" />
                      )}
                    </div>
                  ))}
              </Document>
            )}
          </div>
        </div>
      </div>

      {/* ── Floating selection popup ──────────────────────────────────────── */}
      {popup && (
        <div
          data-pdf-popup
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
          style={{ left: popup.x, top: popup.y - 14 }}>
          <div className="flex items-center gap-0.5 bg-popover border border-border rounded-2xl shadow-2xl p-1">
            <PopBtn
              icon={<Quote className="h-3 w-3" />}
              label="Ask AI"
              primary
              onClick={() => {
                onAskAI(`"${popup.text}"`);
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            />
            <PopBtn
              icon={<Brain className="h-3 w-3" />}
              label="Explain"
              onClick={() => {
                onAskAI(`Explain this: "${popup.text}"`, "explain");
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            />
            <PopBtn
              icon={<Sparkles className="h-3 w-3" />}
              label="Summarize"
              onClick={() => {
                onAskAI(`Summarize this: "${popup.text}"`, "summarize");
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            />
            <PopBtn
              icon={<FlipHorizontal className="h-3 w-3" />}
              label="Flashcard"
              onClick={() => {
                onAskAI(
                  `Create a flashcard Q&A from: "${popup.text}"`,
                  "flashcard",
                );
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            />
            <PopBtn
              icon={<Brain className="h-3 w-3" />}
              label="Quiz me"
              onClick={() => {
                onAskAI(
                  `Generate a quiz question from: "${popup.text}"`,
                  "quiz",
                );
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            />

            <div className="w-px h-5 bg-border mx-0.5" />

            <PopBtn
              icon={
                copiedId === "popup" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )
              }
              label={copiedId === "popup" ? "Copied!" : "Copy"}
              onClick={() => {
                copyText(popup.text, "popup");
              }}
            />
          </div>
        </div>
      )}

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-0.5 border-t border-border shrink-0 bg-muted/30">
        <span className="text-[10px] text-muted-foreground flex-1 tabular-nums">
          {bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}
        </span>
        {readingMode !== "default" && (
          <span className="text-[10px] text-muted-foreground capitalize">
            {readingMode} mode
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {Math.round(scrollProgress * 100)}% read
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  tip,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tip: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={`relative rounded-md p-1 transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}>
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">
      {children}
    </p>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 px-3 text-center text-muted-foreground/60">
      <div className="opacity-40">{icon}</div>
      <p className="text-[11px] leading-snug">{text}</p>
    </div>
  );
}

function SideAction({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] font-medium transition-colors ${
        danger
          ? "text-muted-foreground hover:text-destructive"
          : "text-primary hover:underline"
      }`}>
      {children}
    </button>
  );
}

function PageBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded-full hover:bg-primary/10">
      {icon}
      {label}
    </button>
  );
}

function PopBtn({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[9px] font-semibold transition-all ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}>
      {icon}
      {label}
    </button>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-20">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
