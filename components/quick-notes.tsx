"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  GripHorizontal,
  X,
  Maximize2,
  Minimize2,
  Plus,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  StickyNote,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

const COLLAPSED_H = 44;
const EXPANDED_W = 380;
const EXPANDED_H = 440;

export function QuickNotes() {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const noteIdRef = useRef<string | null>(null);
  const titleRef = useRef("Quick Note");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  /* ── Initial position (bottom-right) ── */
  useEffect(() => {
    const x = window.innerWidth - EXPANDED_W - 24;
    const y = window.innerHeight - EXPANDED_H - 24;
    setPos({ x, y });
    setInitialized(true);
  }, []);

  /* ── On first open: load most recent note or create one ── */
  const bootstrapNote = useCallback(async () => {
    if (noteIdRef.current) return;
    const res = await fetch("/api/notes");
    const data = await res.json();
    if (data.notes && data.notes.length > 0) {
      const recent = data.notes[0];
      noteIdRef.current = recent._id;
      titleRef.current = recent.title;
      if (editorRef.current) editorRef.current.innerHTML = recent.content;
      setShowPlaceholder(!recent.content || recent.content === "<br>");
    } else {
      const createRes = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Quick Note", content: "" }),
      });
      const d = await createRes.json();
      if (d.note) noteIdRef.current = d.note._id;
    }
  }, []);

  /* ── Listen for toggle event ── */
  useEffect(() => {
    const handler = () => {
      setVisible((v) => {
        const next = !v;
        if (next) bootstrapNote();
        return next;
      });
    };
    window.addEventListener("toggle-quick-notes", handler);
    return () => window.removeEventListener("toggle-quick-notes", handler);
  }, [bootstrapNote]);

  /* ── Drag logic ── */
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    },
    [pos],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !windowRef.current) return;
      const el = windowRef.current;
      const maxX = window.innerWidth - el.offsetWidth;
      const maxY = window.innerHeight - el.offsetHeight;
      setPos({
        x: Math.min(Math.max(0, e.clientX - dragOffset.current.x), maxX),
        y: Math.min(Math.max(0, e.clientY - dragOffset.current.y), maxY),
      });
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* ── Auto-save to DB ── */
  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const id = noteIdRef.current;
      if (!id) return;
      const content = editorRef.current?.innerHTML ?? "";
      await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleRef.current, content }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  }, []);

  const createNewNote = useCallback(async () => {
    const createRes = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Quick Note", content: "" }),
    });

    const data = await createRes.json();
    if (!data.note) return;

    noteIdRef.current = data.note._id;
    titleRef.current = data.note.title || "Quick Note";

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
      editorRef.current.focus();
    }

    setShowPlaceholder(true);
    setSaveStatus("idle");
  }, []);

  /* ── Rich text commands ── */
  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  };

  const handleInput = () => {
    setShowPlaceholder(
      editorRef.current?.innerHTML === "" ||
        editorRef.current?.innerHTML === "<br>",
    );
    scheduleAutoSave();
  };

  if (!initialized) return null;

  return (
    <div
      ref={windowRef}
      style={{
        left: pos.x,
        top: pos.y,
        width: EXPANDED_W,
        height: minimized ? COLLAPSED_H : EXPANDED_H,
      }}
      className={[
        "fixed z-9999 flex flex-col",
        "rounded-2xl overflow-hidden",
        "bg-white/10 dark:bg-black/20",
        "backdrop-blur-xl",
        "border border-white/20 dark:border-white/10",
        "shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]",
        "transition-[height,opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        visible
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none translate-y-2",
      ].join(" ")}>
      {/* ── Header / drag handle ── */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none shrink-0
          bg-white/10 dark:bg-white/5 border-b border-white/15 dark:border-white/10">
        <GripHorizontal className="w-3.5 h-3.5 text-white/40 shrink-0" />
        <StickyNote className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="flex-1 text-sm font-semibold text-foreground/90 tracking-wide">
          Quick Notes
        </span>

        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            Saved
          </span>
        )}
        {saveStatus === "saving" && (
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        )}

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={createNewNote}
          title="New note"
          className="p-1 rounded-lg hover:bg-white/15 transition-colors text-foreground/60 hover:text-foreground">
          <Plus className="w-3.5 h-3.5" />
        </button>

        <Link
          href="/notes"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setVisible(false)}
          title="View all notes"
          className="p-1 rounded-lg hover:bg-white/15 transition-colors text-foreground/50 hover:text-foreground">
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setMinimized((m) => !m)}
          className="p-1 rounded-lg hover:bg-white/15 transition-colors text-foreground/60 hover:text-foreground">
          {minimized ? (
            <Maximize2 className="w-3.5 h-3.5" />
          ) : (
            <Minimize2 className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setVisible(false)}
          className="p-1 rounded-lg hover:bg-red-500/20 transition-colors text-foreground/60 hover:text-red-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div
        className={[
          "flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 dark:border-white/8 shrink-0",
          "bg-white/5 dark:bg-black/10",
          "overflow-hidden transition-[max-height,opacity] duration-300",
          minimized
            ? "max-h-0 opacity-0 py-0 border-none"
            : "max-h-12 opacity-100",
        ].join(" ")}>
        {[
          { icon: Bold, cmd: "bold", title: "Bold" },
          { icon: Italic, cmd: "italic", title: "Italic" },
          { icon: Underline, cmd: "underline", title: "Underline" },
          { icon: List, cmd: "insertUnorderedList", title: "Bullet List" },
          {
            icon: ListOrdered,
            cmd: "insertOrderedList",
            title: "Numbered List",
          },
        ].map(({ icon: Icon, cmd, title }) => (
          <button
            key={cmd}
            title={title}
            onMouseDown={(e) => {
              e.preventDefault();
              exec(cmd);
            }}
            className="p-1.5 rounded-lg hover:bg-white/15 dark:hover:bg-white/10 transition-all duration-150
              text-foreground/60 hover:text-foreground active:scale-90">
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}

        <div className="flex-1" />
      </div>

      {/* ── Editor area ── */}
      <div className="relative flex-1 overflow-hidden">
        {showPlaceholder && (
          <span className="absolute top-3 left-4 text-sm text-foreground/30 pointer-events-none select-none">
            Start typing your notes…
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={handleInput}
          className={[
            "w-full h-full p-3 text-sm text-foreground leading-relaxed outline-none overflow-y-auto",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:bg-white/15",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&_ul]:list-disc [&_ul]:pl-5",
            "[&_ol]:list-decimal [&_ol]:pl-5",
          ].join(" ")}
        />
      </div>
    </div>
  );
}
