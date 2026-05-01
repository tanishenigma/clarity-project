"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Highlighter,
  RefreshCw,
  Loader2,
  BookOpenText,
  ChevronDown,
  FileText,
  Edit3,
  Send,
  X,
  Plus,
  Check,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface QuickReference {
  keyTerms: string;
  fundamentalTheories: string;
  essentialFormulas: string;
  keyExamples: string;
  keyApplications: string;
  factsToMemorize: string;
  referenceInfo: string;
  conceptComparisons: string;
  combined?: string;
  [key: string]: string | undefined;
}

interface Summary {
  outline: string;
  quickReference: QuickReference;
}

interface SummaryTabProps {
  spaceId: string;
  userId: string;
  hasContent: boolean;
  spaceName: string;
}

/* ── Section metadata ───────────────────────────────────────────────────────── */

const SECTIONS: {
  key: keyof QuickReference;
  label: string;
}[] = [
  { key: "keyTerms", label: "Key Terms & Concepts" },
  { key: "fundamentalTheories", label: "Fundamental Theories" },
  { key: "essentialFormulas", label: "Essential Formulas" },
  { key: "keyExamples", label: "Key Examples" },
  { key: "keyApplications", label: "Key Applications" },
  { key: "factsToMemorize", label: "Facts to Memorize" },
  { key: "referenceInfo", label: "Reference Information" },
  { key: "conceptComparisons", label: "Concept Comparisons" },
];

/* ── Highlight-toggle helper ─────────────────────────────────────────────── */

/** Returns true if every selected node already carries our highlight colour. */
function selectionIsHighlighted(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);

  const matchesBg = (el: HTMLElement | null) => {
    while (el) {
      const bg = el.style?.backgroundColor ?? "";
      if (bg === "rgb(251, 191, 36)" || bg === "#fbbf24") return true;
      el = el.parentElement;
    }
    return false;
  };

  // Check ancestor of the range container first
  const container =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement;
  if (matchesBg(container)) return true;

  // Walk every element inside the cloned fragment
  const fragment = range.cloneContents();
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = fragment.firstChild;
  while (node) {
    if (matchesBg(node as HTMLElement)) return true;
    node = walker.nextNode();
  }
  return false;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export function SummaryTab({
  spaceId,
  userId,
  hasContent,
  spaceName,
}: SummaryTabProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    "outline" | "quickReference"
  >("outline");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToNotes, setSavedToNotes] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* floating selection-menu state */
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [textStyleOpen, setTextStyleOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const textStyleRef = useRef<HTMLDivElement>(null);

  const outlineRef = useRef<HTMLDivElement>(null);
  const quickRefDocRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enhanceMenuRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const getActiveContentElement = useCallback(
    () =>
      activeSubTab === "outline" ? outlineRef.current : quickRefDocRef.current,
    [activeSubTab],
  );

  /* Load existing summary on mount */
  useEffect(() => {
    setLoading(true);
    fetch(`/api/spaces/${spaceId}/summary?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then(({ summary: s }) => {
        if (s)
          setSummary({
            outline: s.outline || "",
            quickReference: s.quickReference || {},
          });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [spaceId, userId]);

  /* Populate editable divs whenever summary changes */
  useEffect(() => {
    if (!summary) return;
    if (outlineRef.current && outlineRef.current.innerHTML !== summary.outline)
      outlineRef.current.innerHTML = summary.outline;

    if (quickRefDocRef.current) {
      const combined = summary.quickReference.combined;
      const html = combined
        ? combined
        : SECTIONS.map(
            ({ key, label }) =>
              `<h3>${label}</h3>${summary.quickReference[key] || ""}`,
          ).join("");
      if (quickRefDocRef.current.innerHTML !== html)
        quickRefDocRef.current.innerHTML = html;
    }
  }, [summary]);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        enhanceMenuRef.current &&
        !enhanceMenuRef.current.contains(e.target as Node)
      )
        setEnhanceOpen(false);
      if (
        textStyleRef.current &&
        !textStyleRef.current.contains(e.target as Node)
      )
        setTextStyleOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const collectCurrentContent = useCallback((): Summary => {
    const outlineHtml = outlineRef.current?.innerHTML ?? "";
    const combined = quickRefDocRef.current?.innerHTML ?? "";
    return {
      outline: outlineHtml,
      quickReference: { combined } as QuickReference,
    };
  }, []);

  /* Auto-save (debounced) */
  const autoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      const content = collectCurrentContent();
      try {
        await fetch(`/api/spaces/${spaceId}/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: "save", ...content }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
  }, [spaceId, userId, collectCurrentContent]);

  /* Exit edit mode and trigger save */
  const handleDone = useCallback(() => {
    setIsEditingMode(false);
    autoSave();
  }, [autoSave]);

  /* Apply block format (for text style dropdown) */
  const execFormat = (tag: string) => {
    document.execCommand("formatBlock", false, tag);
    setTextStyleOpen(false);
  };

  /* Generate summary via AI */
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const s = data.summary;
      setSummary({
        outline: s.outline || "",
        quickReference: s.quickReference || {},
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  };

  /* Rich-text formatting helper */
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  /* Enhance selected text via Enhance dropdown (explain/example/reword) */
  const handleEnhanceDropdown = async (
    type: "explain" | "example" | "reword",
  ) => {
    setEnhanceOpen(false);
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();
    if (!selectedText) return;
    setEnhancing(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/summary/enhance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, text: selectedText, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(data.result);
        range.insertNode(fragment);
        sel.removeAllRanges();
        autoSave();
      }
    } catch (e) {
      console.error("Enhance error:", e);
    } finally {
      setEnhancing(false);
    }
  };

  /* Save to Notes */
  const handleSaveToNotes = async () => {
    setSaving(true);
    const content = collectCurrentContent();
    const htmlContent =
      activeSubTab === "outline"
        ? content.outline
        : (quickRefDocRef.current?.innerHTML ??
          content.quickReference.combined ??
          "");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${spaceName} — ${activeSubTab === "outline" ? "Outline" : "Quick Reference"}`,
          content: htmlContent,
          userId,
        }),
      });
      if (res.ok) {
        setSavedToNotes(true);
        setTimeout(() => setSavedToNotes(false), 2500);
      }
    } catch (e) {
      console.error("Save to notes error:", e);
    } finally {
      setSaving(false);
    }
  };

  /* ── Floating text-selection menu ─────────────────────────────────────── */
  const hideMenu = useCallback(() => {
    setMenuVisible(false);
    setEditMode(false);
    setEditInstruction("");
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);

    selectionTimerRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        hideMenu();
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        hideMenu();
        return;
      }

      const range = selection.getRangeAt(0);
      if (!contentAreaRef.current?.contains(range.commonAncestorContainer)) {
        hideMenu();
        return;
      }

      const rect = range.getBoundingClientRect();
      setMenuPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      setSelectedText(text);
      setSavedRange(range.cloneRange());
      setMenuVisible(true);
      setEditMode(false);
      setEditInstruction("");
    }, 70);
  }, [hideMenu]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    if (!menuVisible) return;
    const onPD = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-sel-menu]")) hideMenu();
    };
    document.addEventListener("pointerdown", onPD);
    return () => document.removeEventListener("pointerdown", onPD);
  }, [menuVisible, hideMenu]);

  const restoreRange = useCallback(() => {
    if (!savedRange) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }, [savedRange]);

  const handleMenuHighlight = useCallback(() => {
    // Check highlight state BEFORE restoring range (selection still intact)
    const alreadyHighlighted = selectionIsHighlighted();
    const activeContentElement = getActiveContentElement();
    if (!activeContentElement) return;

    const temporaryEditMode =
      !isEditingMode && !activeContentElement.isContentEditable;

    if (temporaryEditMode) {
      activeContentElement.setAttribute("contenteditable", "true");
      activeContentElement.focus({ preventScroll: true });
    }

    if (!restoreRange()) return;

    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(
      "hiliteColor",
      false,
      alreadyHighlighted ? "transparent" : "#fbbf24",
    );

    if (temporaryEditMode) {
      activeContentElement.setAttribute("contenteditable", "false");
      window.getSelection()?.removeAllRanges();
    }

    hideMenu();
    autoSave();
  }, [
    restoreRange,
    hideMenu,
    autoSave,
    getActiveContentElement,
    isEditingMode,
  ]);

  const handleMenuEnhance = useCallback(
    async (text: string, instruction?: string) => {
      const activeContentElement = getActiveContentElement();
      if (!activeContentElement) return;

      const temporaryEditMode =
        !isEditingMode && !activeContentElement.isContentEditable;

      if (temporaryEditMode) {
        activeContentElement.setAttribute("contenteditable", "true");
        activeContentElement.focus({ preventScroll: true });
      }

      if (!restoreRange()) return;
      setMenuLoading(true);
      try {
        const res = await fetch("/api/notes/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            text,
            mode: instruction ? "edit" : "enhance",
            instruction,
          }),
        });
        const data = await res.json();
        if (data.enhanced) {
          restoreRange();
          document.execCommand("insertText", false, data.enhanced);
          autoSave();
        }
      } catch (e) {
        console.error("[Enhance]", e);
      } finally {
        if (temporaryEditMode) {
          activeContentElement.setAttribute("contenteditable", "false");
          window.getSelection()?.removeAllRanges();
        }
        setMenuLoading(false);
        hideMenu();
      }
    },
    [restoreRange, hideMenu, autoSave, getActiveContentElement, isEditingMode],
  );

  const submitEdit = useCallback(() => {
    if (!editInstruction.trim()) return;
    handleMenuEnhance(selectedText, editInstruction.trim());
  }, [editInstruction, selectedText, handleMenuEnhance]);

  useEffect(() => {
    if (editMode) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editMode]);

  /* ── Loading spinner ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <Card className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </Card>
    );
  }

  /* ── Empty / generation prompt ───────────────────────────────────────── */
  if (!summary && !generating) {
    return (
      <Card className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center border-dashed">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <BookOpenText className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">No Summary Yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {hasContent
              ? "Generate an AI-powered summary of this space. It includes a structured outline and quick-reference notes you can edit."
              : "Add some content to this space first, then come back to generate a summary."}
          </p>
        </div>
        {hasContent && (
          <Button onClick={handleGenerate} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Generate Summary
          </Button>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          Generating summary — this may take a moment…
        </p>
      </Card>
    );
  }

  /* ── Main view ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        {isEditingMode ? (
          /* ── EDIT MODE toolbar ── */
          <div className="flex items-center gap-1 px-3 py-2">
            {/* Text style dropdown */}
            <div className="relative" ref={textStyleRef}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setTextStyleOpen((o) => !o);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted text-xs font-medium text-foreground transition-colors min-w-24 justify-between">
                Text style
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              {textStyleOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-popover/70 backdrop-blur-md border border-border/60 rounded-[10px] shadow-xl py-1 z-50">
                  {[
                    { tag: "p", label: "Paragraph" },
                    { tag: "h1", label: "Heading 1" },
                    { tag: "h2", label: "Heading 2" },
                    { tag: "h3", label: "Heading 3" },
                  ].map(({ tag, label }) => (
                    <button
                      key={tag}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        execFormat(tag);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Formatting buttons */}
            {[
              {
                cmd: "bold",
                icon: <Bold className="w-3.5 h-3.5" />,
                title: "Bold",
              },
              {
                cmd: "italic",
                icon: <Italic className="w-3.5 h-3.5" />,
                title: "Italic",
              },
              {
                cmd: "underline",
                icon: <Underline className="w-3.5 h-3.5" />,
                title: "Underline",
              },
              {
                cmd: "hiliteColor",
                icon: <Highlighter className="w-3.5 h-3.5 text-amber-400" />,
                title: "Highlight",
                value: "#fbbf24",
              },
              {
                cmd: "insertUnorderedList",
                icon: <List className="w-3.5 h-3.5" />,
                title: "Bullet list",
              },
              {
                cmd: "insertOrderedList",
                icon: <ListOrdered className="w-3.5 h-3.5" />,
                title: "Numbered list",
              },
            ].map(({ cmd, value, icon, title }) => (
              <button
                key={cmd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (cmd === "hiliteColor") {
                    const alreadyHighlighted = selectionIsHighlighted();
                    execCmd(
                      cmd,
                      alreadyHighlighted ? "transparent" : "#fbbf24",
                    );
                  } else {
                    execCmd(cmd, value);
                  }
                }}
                title={title}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-90">
                {icon}
              </button>
            ))}

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd("insertHTML", "<p><br></p>");
              }}
              title="Insert paragraph"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-90">
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Enhance dropdown */}
            <div className="relative" ref={enhanceMenuRef}>
              <button
                onClick={() => setEnhanceOpen((o) => !o)}
                disabled={enhancing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50">
                {enhancing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                )}
                Enhance
              </button>
              {enhanceOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-popover/70 backdrop-blur-md border border-border/60 rounded-[10px] shadow-xl py-1 z-50">
                  {[
                    { type: "explain" as const, label: "Explain this" },
                    { type: "example" as const, label: "See an example" },
                    { type: "reword" as const, label: "Reword this" },
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => handleEnhanceDropdown(type)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Save status */}
            {saveStatus !== "idle" && (
              <span className="text-xs text-muted-foreground">
                {saveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            )}

            {/* Done */}
            <button
              onClick={handleDone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
          </div>
        ) : (
          /* ── READ MODE tab row ── */
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-6 pt-2">
              {(["outline", "quickReference"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={[
                    "pb-2 text-sm font-medium border-b-2 transition-colors",
                    activeSubTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  ].join(" ")}>
                  {tab === "outline" ? "Outline" : "Quick Reference"}
                </button>
              ))}
            </div>
            {/* Read-mode right actions */}
            <div className="flex items-center gap-1 py-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveToNotes}
                disabled={saving}
                className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground">
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {savedToNotes ? "Saved ✓" : "Save to Notes"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleGenerate}
                disabled={generating || !hasContent}
                className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground">
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div ref={contentAreaRef} className="flex-1">
        {/* Outline — always rendered, hidden via CSS */}
        <div className={activeSubTab === "outline" ? "block" : "hidden"}>
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div
              ref={outlineRef}
              contentEditable={isEditingMode}
              suppressContentEditableWarning
              onInput={autoSave}
              className={[
                "outline-none min-h-96 text-foreground",
                "prose prose-sm dark:prose-invert max-w-none",
                "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-0 [&_h1]:mb-5",
                "[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2",
                "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
                "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
                "[&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold",
                "**:[[style*='background-color']]:text-gray-900!",
                "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none",
              ].join(" ")}
              data-placeholder="Your outline will appear here…"
            />
          </div>
        </div>

        {/* Quick Reference — always rendered, hidden via CSS */}
        <div className={activeSubTab === "quickReference" ? "block" : "hidden"}>
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div
              ref={quickRefDocRef}
              contentEditable={isEditingMode}
              suppressContentEditableWarning
              onInput={autoSave}
              className={[
                "outline-none min-h-96 text-foreground",
                "prose prose-sm dark:prose-invert max-w-none",
                "[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:first:mt-0",
                "[&_h3]:border-b [&_h3]:border-border [&_h3]:pb-1",
                "[&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5",
                "[&_ol]:list-decimal [&_ol]:pl-5",
                "[&_p]:my-1 [&_strong]:font-semibold",
                "[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse",
                "[&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:border [&_th]:border-border",
                "[&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-border",
                "**:[[style*='background-color']]:text-gray-900!",
                "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none",
              ].join(" ")}
              data-placeholder="Your quick reference will appear here…"
            />
          </div>
        </div>
      </div>

      {/* ── Floating text-selection menu ──────────────────────────────────── */}
      {menuVisible && (
        <div
          data-sel-menu
          style={{
            position: "fixed",
            left: menuPos.x,
            top: menuPos.y,
            transform: "translate(-50%,-100%)",
            zIndex: 9999,
          }}
          className="flex flex-col rounded-[10px] border border-border/60 bg-background backdrop-blur-xl shadow-2xl overflow-hidden origin-bottom  fade-in zoom-in-95 slide-in-from-top-1 duration-150">
          {!editMode ? (
            <div className="flex items-center animate-in fade-in duration-150">
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsEditingMode(true);
                  hideMenu();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <div className="w-px h-5 bg-border" />
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleMenuHighlight();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-500 hover:bg-amber-500/10 transition-colors">
                <Highlighter className="w-3.5 h-3.5" /> Highlight
              </button>
              <div className="w-px h-5 bg-border" />
              <button
                disabled={menuLoading}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleMenuEnhance(selectedText);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                {menuLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Enhance
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1.5 animate-in fade-in duration-150">
              <input
                ref={editInputRef}
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitEdit();
                  }
                  if (e.key === "Escape") setEditMode(false);
                }}
                placeholder="e.g. make it more concise…"
                className="w-52 text-xs bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
              />
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  submitEdit();
                }}
                disabled={!editInstruction.trim() || menuLoading}
                className="p-1 rounded-lg hover:bg-muted text-primary disabled:opacity-40 transition-colors">
                {menuLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditMode(false);
                }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
