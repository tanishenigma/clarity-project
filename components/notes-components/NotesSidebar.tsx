"use client";

import { PanelLeftClose, Plus, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note, stripHtml } from "./types";

/* ── Animated hamburger / X icon ── */
export function NotesHamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="flex flex-col justify-center items-center w-5 h-5 gap-1.25">
      <span
        className={[
          "block h-[1.5px] w-5 bg-current rounded-full origin-center transition-all duration-300 ease-in-out",
          open ? "rotate-45 translate-y-[6.5px]" : "",
        ].join(" ")}
      />
      <span
        className={[
          "block h-[1.5px] w-5 bg-current rounded-full transition-all duration-300 ease-in-out",
          open ? "opacity-0 scale-x-0" : "",
        ].join(" ")}
      />
      <span
        className={[
          "block h-[1.5px] w-5 bg-current rounded-full origin-center transition-all duration-300 ease-in-out",
          open ? "-rotate-45 -translate-y-[6.5px]" : "",
        ].join(" ")}
      />
    </span>
  );
}

export function NotesHamburger({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? "Close notes list" : "Open notes list"}
      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
      <NotesHamburgerIcon open={open} />
    </button>
  );
}

interface NotesSidebarProps {
  notes: Note[];
  activeId: string | null;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

/* ── Shared note list body ── */
function NotesList({
  notes,
  activeId,
  onSelectNote,
  onCreateNote,
  onToggle,
  closesOnSelect,
}: {
  notes: Note[];
  activeId: string | null;
  onSelectNote: (n: Note) => void;
  onCreateNote: () => void;
  onToggle: () => void;
  closesOnSelect: boolean;
}) {
  return (
    <>
      <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
        <Button
          onClick={() => {
            onCreateNote();
            if (closesOnSelect) onToggle();
          }}
          size="sm"
          className="flex-1 gap-2 rounded-xl">
          <Plus className="w-4 h-4" />
          Create New Note
        </Button>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
          {closesOnSelect ? (
            <X className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        Notes
      </p>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <StickyNote className="w-8 h-8 opacity-30" />
            <p className="text-xs text-center">
              No notes yet.
              <br />
              Create your first one!
            </p>
          </div>
        )}
        {notes.map((note) => {
          const isActive = note._id === activeId;
          const excerpt = stripHtml(note.content);
          return (
            <button
              key={note._id}
              onClick={() => {
                onSelectNote(note);
                if (closesOnSelect) onToggle();
              }}
              className={[
                "w-full text-left px-3 py-2.5 rounded-[10px] transition-all duration-150 group",
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/60 border border-transparent",
              ].join(" ")}>
              <p
                className={`text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                {note.title || "Untitled"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {excerpt || "Empty Note"}
              </p>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function NotesSidebar({
  notes,
  activeId,
  onSelectNote,
  onCreateNote,
  isOpen,
  onToggle,
}: NotesSidebarProps) {
  return (
    <>
      {/* ══════════════════════════
          MOBILE overlay drawer
          (hidden on md+)
          ══════════════════════════ */}
      <aside
        className={[
          "fixed top-12 right-0 h-[calc(100%-3rem)] w-72 z-50 flex flex-col",
          "bg-background border-l border-border shadow-2xl md:hidden",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}>
        <NotesList
          notes={notes}
          activeId={activeId}
          onSelectNote={onSelectNote}
          onCreateNote={onCreateNote}
          onToggle={onToggle}
          closesOnSelect
        />
      </aside>

      {/* ══════════════════════════
          DESKTOP inline collapsible
          (hidden on mobile)
          ══════════════════════════ */}
      <div className="relative hidden md:flex shrink-0">
        <div
          className={[
            "flex flex-col border-r border-border bg-muted/20 overflow-hidden h-full",
            "transition-[width] duration-300 ease-in-out",
            isOpen ? "w-64" : "w-0",
          ].join(" ")}>
          {isOpen && (
            <NotesList
              notes={notes}
              activeId={activeId}
              onSelectNote={onSelectNote}
              onCreateNote={onCreateNote}
              onToggle={onToggle}
              closesOnSelect={false}
            />
          )}
        </div>
      </div>
    </>
  );
}
