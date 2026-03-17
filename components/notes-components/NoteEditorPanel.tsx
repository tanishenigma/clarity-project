"use client";

import {
  CheckCircle2,
  PanelLeftOpen,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotesToolbar } from "./NotesToolbar";
import { Note, formatDate } from "./types";

interface NoteEditorPanelProps {
  activeNote: Note | undefined;
  activeId: string | null;
  title: string;
  saveStatus: "idle" | "saving" | "saved";
  deleting: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  onTitleChange: (value: string) => void;
  onEditorInput: () => void;
  onDelete: () => void;
  onCreateNote: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function NoteEditorPanel({
  activeNote,
  activeId,
  title,
  saveStatus,
  deleting,
  editorRef,
  onTitleChange,
  onEditorInput,
  onDelete,
  onCreateNote,
  onToggleSidebar,
  sidebarOpen,
}: NoteEditorPanelProps) {
  const getSelectionRangeInEditor = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.startContainer)) return null;
    return range;
  };

  const getCurrentBlockElement = (range: Range) => {
    const editor = editorRef.current;
    if (!editor) return null;

    if (range.startContainer === editor) {
      const offset = Math.max(0, range.startOffset - 1);
      const child = editor.childNodes[offset];
      if (child instanceof HTMLElement) return child;
      if (child?.parentElement && child.parentElement !== editor) {
        let node: HTMLElement | null = child.parentElement;
        while (node && node !== editor) {
          if (node.parentElement === editor) return node;
          node = node.parentElement;
        }
      }
    }

    let node: HTMLElement | null =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;

    while (node && node !== editor) {
      if (node.parentElement === editor) return node;
      node = node.parentElement;
    }

    return null;
  };

  const isCaretAtEndOfBlock = (range: Range, block: HTMLElement) => {
    if (!range.collapsed) return false;

    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(block);
    beforeRange.setEnd(range.endContainer, range.endOffset);

    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(block);
    afterRange.setStart(range.endContainer, range.endOffset);

    return afterRange.toString().trim() === "";
  };

  const placeCaretAfterNode = (node: Node) => {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const applyInlinePattern = (
    textNode: Text,
    range: Range,
    regex: RegExp,
    tagName: "strong" | "em" | "code" | "s",
    appendTrailingSpace = true,
  ) => {
    const textBeforeCaret = textNode.data.slice(0, range.startOffset);
    const match = textBeforeCaret.match(regex);
    if (!match || !match[1]) return false;

    const matchedText = match[0];
    const innerText = match[1];
    const startOffset = textBeforeCaret.length - matchedText.length;

    const replaceRange = document.createRange();
    replaceRange.setStart(textNode, startOffset);
    replaceRange.setEnd(textNode, range.startOffset);

    replaceRange.deleteContents();

    const formattedNode = document.createElement(tagName);
    formattedNode.textContent = innerText;

    replaceRange.insertNode(formattedNode);

    if (appendTrailingSpace) {
      const trailingSpace = document.createTextNode(" ");
      formattedNode.parentNode?.insertBefore(
        trailingSpace,
        formattedNode.nextSibling,
      );
      placeCaretAfterNode(trailingSpace);
    } else {
      placeCaretAfterNode(formattedNode);
    }

    onEditorInput();
    return true;
  };

  const getTextNodeAtCaret = (range: Range) => {
    if (range.startContainer instanceof Text) return range.startContainer;

    if (range.startContainer instanceof HTMLElement) {
      const container = range.startContainer;
      const index = Math.max(0, range.startOffset - 1);
      const candidate = container.childNodes[index];
      if (candidate instanceof Text) return candidate;
      if (candidate?.lastChild instanceof Text) return candidate.lastChild;
    }

    return null;
  };

  const tryHandleInlineMarkdownShortcut = (appendTrailingSpace = true) => {
    const range = getSelectionRangeInEditor();
    if (!range || !range.collapsed) return false;
    const textNode = getTextNodeAtCaret(range);
    if (!textNode) return false;

    const caretOffset =
      range.startContainer instanceof Text
        ? range.startOffset
        : textNode.length;

    const adjustedRange = document.createRange();
    adjustedRange.setStart(textNode, caretOffset);
    adjustedRange.setEnd(textNode, caretOffset);

    const patterns: Array<{
      regex: RegExp;
      tag: "strong" | "em" | "code" | "s";
    }> = [
      { regex: /\*\*([^*\n]+)\*\*$/, tag: "strong" },
      { regex: /(^|[^*])\*([^*\n]+)\*$/, tag: "em" },
      { regex: /`([^`\n]+)`$/, tag: "code" },
      { regex: /~~([^~\n]+)~~$/, tag: "s" },
    ];

    for (const pattern of patterns) {
      if (pattern.tag === "em") {
        const textBeforeCaret = textNode.data.slice(0, caretOffset);
        const match = textBeforeCaret.match(pattern.regex);
        if (!match || !match[2]) continue;

        const matchedText = match[0];
        const prefix = match[1] ?? "";
        const innerText = match[2];
        const startOffset =
          textBeforeCaret.length - matchedText.length + prefix.length;

        const replaceRange = document.createRange();
        replaceRange.setStart(textNode, startOffset);
        replaceRange.setEnd(textNode, caretOffset);

        replaceRange.deleteContents();

        const emNode = document.createElement("em");
        emNode.textContent = innerText;
        replaceRange.insertNode(emNode);

        if (appendTrailingSpace) {
          const trailingSpace = document.createTextNode(" ");
          emNode.parentNode?.insertBefore(trailingSpace, emNode.nextSibling);
          placeCaretAfterNode(trailingSpace);
        } else {
          placeCaretAfterNode(emNode);
        }

        onEditorInput();
        return true;
      }

      if (
        applyInlinePattern(
          textNode,
          adjustedRange,
          pattern.regex,
          pattern.tag,
          appendTrailingSpace,
        )
      ) {
        return true;
      }
    }

    return false;
  };

  const tryHandleBlockMarkdownShortcut = () => {
    const range = getSelectionRangeInEditor();
    if (!range || !range.collapsed) return false;

    const block = getCurrentBlockElement(range);
    if (!block || !isCaretAtEndOfBlock(range, block)) return false;

    const blockText = (block.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!blockText) return false;

    const runBlockCommand = (command: string, value?: string) => {
      block.textContent = "";
      execEditorCommand(command, value);
    };

    if (blockText === "#") {
      runBlockCommand("formatBlock", "H1");
      return true;
    }

    if (blockText === "##") {
      runBlockCommand("formatBlock", "H2");
      return true;
    }

    if (blockText === "###") {
      runBlockCommand("formatBlock", "H3");
      return true;
    }

    if (blockText === "####") {
      runBlockCommand("formatBlock", "H4");
      return true;
    }

    if (blockText === ">") {
      runBlockCommand("formatBlock", "BLOCKQUOTE");
      return true;
    }

    if (blockText === "```") {
      runBlockCommand("formatBlock", "PRE");
      return true;
    }

    if (blockText === "-" || blockText === "*" || blockText === "+") {
      runBlockCommand("insertUnorderedList");
      return true;
    }

    if (/^\d+\.$/.test(blockText)) {
      runBlockCommand("insertOrderedList");
      return true;
    }

    if (blockText === "---" || blockText === "***") {
      block.textContent = "";
      execEditorCommand("insertHorizontalRule");
      return true;
    }

    return false;
  };

  const execEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onEditorInput();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") {
      if (
        tryHandleBlockMarkdownShortcut() ||
        tryHandleInlineMarkdownShortcut()
      ) {
        e.preventDefault();
        return;
      }
    }

    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;

    const key = e.key.toLowerCase();

    if (key === "b") {
      e.preventDefault();
      execEditorCommand("bold");
      return;
    }

    if (key === "i") {
      e.preventDefault();
      execEditorCommand("italic");
      return;
    }

    if (key === "u") {
      e.preventDefault();
      execEditorCommand("underline");
      return;
    }

    if (key === "s") {
      e.preventDefault();
      onEditorInput();
      return;
    }

    if (e.shiftKey && key === "7") {
      e.preventDefault();
      execEditorCommand("insertOrderedList");
      return;
    }

    if (e.shiftKey && key === "8") {
      e.preventDefault();
      execEditorCommand("insertUnorderedList");
      return;
    }

    if (e.shiftKey && key === "x") {
      e.preventDefault();
      execEditorCommand("strikeThrough");
      return;
    }

    if (e.shiftKey && key === "`") {
      e.preventDefault();
      execEditorCommand("formatBlock", "PRE");
      return;
    }

    if (!e.shiftKey && ["1", "2", "3", "4"].includes(key)) {
      e.preventDefault();
      execEditorCommand("formatBlock", `H${key}`);
    }
  };

  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (["*", "`", "~"].includes(e.key)) {
      tryHandleInlineMarkdownShortcut(false);
    }
  };

  if (!activeId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — title left, panel toggle right */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background/60 shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            Notes
          </span>{" "}
          {!sidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              className="h-7 px-2 text-xs">
              <PanelLeftOpen />
            </Button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <StickyNote className="w-12 h-12 opacity-20" />
          <p className="text-sm">Select a note or create a new one</p>
          <Button onClick={onCreateNote} size="sm" className="gap-2 rounded-xl">
            <Plus className="w-4 h-4" />
            Create Note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar: title+timestamp on left, save status + delete + panel toggle on right */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background/60 shrink-0 gap-2">
        {/* Left: current note info */}
        <div className="flex gap-2">
          {" "}
          {!sidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              className="h-7 px-2 text-xs hidden md:block">
              <PanelLeftOpen />
            </Button>
          )}
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {activeNote?.title || "Untitled"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate hidden sm:block leading-tight">
              {activeNote ? `Updated ${formatDate(activeNote.updatedAt)}` : ""}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Saved</span>
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Saving…
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={deleting}
            onClick={onDelete}
            className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive rounded-xl h-7 px-2">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Delete</span>
          </Button>
          {!sidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              className="h-7 px-2 text-xs md:hidden">
              <PanelLeftOpen />
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <NotesToolbar editorRef={editorRef} />

      {/* Editor */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled"
            className="w-full text-3xl sm:text-4xl font-bold text-foreground bg-transparent outline-none border-none placeholder:text-muted-foreground/30 mb-4"
          />
          <hr className="border-border mb-6" />

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={handleEditorKeyUp}
            data-placeholder="Start writing your note…"
            className={[
              "min-h-64 text-foreground text-base leading-relaxed outline-none",
              "prose prose-neutral dark:prose-invert max-w-none",
              "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
              "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2",
              "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
              "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1",
              "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3",
              "[&_pre]:bg-gray-800 [&_pre]:text-white [&_pre]:rounded-[10px] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre",
              "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
              "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
              "[&_hr]:border-border [&_hr]:my-4",
              "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30 empty:before:pointer-events-none",
            ].join(" ")}
          />
        </div>
      </div>
    </div>
  );
}
