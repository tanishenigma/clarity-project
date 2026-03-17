"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { NotesSidebar } from "@/components/notes-components/NotesSidebar";
import { NoteEditorPanel } from "@/components/notes-components/NoteEditorPanel";
import { Note } from "@/components/notes-components/types";

export default function NotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef(title);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  /* ── Load notes ── */
  useEffect(() => {
    if (!user) return;
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        if (data.notes) {
          setNotes(data.notes);
          if (data.notes.length > 0) loadNote(data.notes[0]);
        }
      })
      .finally(() => setFetching(false));
  }, [user]);

  const loadNote = (note: Note) => {
    setActiveId(note._id);
    setTitle(note.title);
    setSaveStatus("idle");
    if (editorRef.current) editorRef.current.innerHTML = note.content;
  };

  /* ── Auto-save ── */
  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const id = activeIdRef.current;
      if (!id) return;
      const content = editorRef.current?.innerHTML ?? "";
      await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleRef.current, content }),
      });
      setNotes((prev) =>
        prev.map((n) =>
          n._id === id
            ? {
                ...n,
                title: titleRef.current,
                content,
                updatedAt: new Date().toISOString(),
              }
            : n,
        ),
      );
      setSaveStatus("saved");
    }, 800);
  }, []);

  /* ── Create new note ── */
  const createNote = async () => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", content: "" }),
    });
    const data = await res.json();
    if (data.note) {
      setNotes((prev) => [data.note, ...prev]);
      loadNote(data.note);
    }
  };

  /* ── Delete active note ── */
  const deleteNote = async () => {
    if (!activeId) return;
    setDeleting(true);
    await fetch(`/api/notes/${activeId}`, { method: "DELETE" });
    const remaining = notes.filter((n) => n._id !== activeId);
    setNotes(remaining);
    if (remaining.length > 0) {
      loadNote(remaining[0]);
    } else {
      setActiveId(null);
      setTitle("");
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
    setDeleting(false);
  };

  const activeNote = notes.find((n) => n._id === activeId);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] md:h-[calc(100vh-2rem)] gap-0 -m-4 sm:-m-6 md:-m-8 overflow-hidden">
      <NotesSidebar
        notes={notes}
        activeId={activeId}
        onSelectNote={loadNote}
        onCreateNote={createNote}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex-1 flex flex-col bg-muted/10 overflow-hidden min-w-0">
        <NoteEditorPanel
          activeNote={activeNote}
          activeId={activeId}
          title={title}
          saveStatus={saveStatus}
          deleting={deleting}
          editorRef={editorRef}
          onTitleChange={(val) => {
            setTitle(val);
            scheduleAutoSave();
          }}
          onEditorInput={scheduleAutoSave}
          onDelete={deleteNote}
          onCreateNote={createNote}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
      </div>
    </div>
  );
}
