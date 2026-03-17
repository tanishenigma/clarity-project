"use client";

import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  Strikethrough,
  Code,
  Minus,
} from "lucide-react";

interface NotesToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export function NotesToolbar({ editorRef }: NotesToolbarProps) {
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const toolbarItems = [
    { icon: Heading1, action: () => exec("formatBlock", "H1"), title: "H1" },
    { icon: Heading2, action: () => exec("formatBlock", "H2"), title: "H2" },
    { icon: Heading3, action: () => exec("formatBlock", "H3"), title: "H3" },
    { icon: Heading4, action: () => exec("formatBlock", "H4"), title: "H4" },
    null,
    { icon: Bold, action: () => exec("bold"), title: "Bold" },
    { icon: Italic, action: () => exec("italic"), title: "Italic" },
    { icon: Underline, action: () => exec("underline"), title: "Underline" },
    {
      icon: Strikethrough,
      action: () => exec("strikeThrough"),
      title: "Strikethrough",
    },
    null,
    {
      icon: Quote,
      action: () => exec("formatBlock", "BLOCKQUOTE"),
      title: "Quote",
    },
    {
      icon: Code,
      action: () => exec("formatBlock", "PRE"),
      title: "Code Block",
    },
    null,
    {
      icon: ListOrdered,
      action: () => exec("insertOrderedList"),
      title: "Ordered List",
    },
    {
      icon: List,
      action: () => exec("insertUnorderedList"),
      title: "Bullet List",
    },
    null,
    {
      icon: Minus,
      action: () => exec("insertHorizontalRule"),
      title: "Divider",
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-background/80 shrink-0 overflow-x-auto scrollbar-none">
      {toolbarItems.map((item, i) =>
        item === null ? (
          <div key={i} className="w-px h-5 bg-border mx-1" />
        ) : (
          <button
            key={item.title}
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              item.action();
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-all duration-150 text-foreground/60 hover:text-foreground active:scale-90">
            <item.icon className="w-4 h-4" />
          </button>
        ),
      )}
    </div>
  );
}
