"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Upload,
  Link2,
  ClipboardPaste,
  ArrowUp,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActionType = "upload" | "link" | "paste" | null;

export default function AddContentPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [linkValue, setLinkValue] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleActionClick = (action: ActionType) => {
    setActiveAction((prev) => (prev === action ? null : action));
    if (action === "upload") {
      setTimeout(() => fileInputRef.current?.click(), 50);
    }
  };

  const navigateToChat = (prefillText?: string, file?: File) => {
    setIsNavigating(true);
    sessionStorage.setItem("chat:new", "1");
    if (prefillText) {
      sessionStorage.setItem("chat:prefill", prefillText);
    }
    if (file) {
      // Store file metadata; the chat page will open upload picker
      sessionStorage.setItem(
        "chat:pendingFile",
        JSON.stringify({ name: file.name, type: file.type }),
      );
      // Store actual file blob in a global ref so chat page can pick it up
      (window as any).__pendingChatFile = file;
    }
    router.push("/chat");
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (activeAction === "link" && linkValue.trim()) {
      navigateToChat(`Analyse and summarize this: ${linkValue.trim()}`);
    } else if (activeAction === "paste" && pasteValue.trim()) {
      navigateToChat(pasteValue.trim());
    } else if (activeAction === "upload" && selectedFile) {
      navigateToChat(undefined, selectedFile);
    }
  };

  const handleQuickSend = () => {
    if (quickInput.trim()) {
      navigateToChat(quickInput.trim());
    }
  };

  const actions = [
    {
      id: "upload" as ActionType,
      icon: Upload,
      label: "Upload",
      sublabel: "Files",
    },
    {
      id: "link" as ActionType,
      icon: Link2,
      label: "Link",
      sublabel: "YouTube",
    },
    {
      id: "paste" as ActionType,
      icon: ClipboardPaste,
      label: "Paste",
      sublabel: "Copied Text",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-10 px-3 sm:px-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*,audio/*,video/*,text/plain"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Greeting */}
      <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6 sm:mb-8 text-center">
        {user
          ? `Hey ${user.username.charAt(0).toUpperCase() + user.username.slice(1)}, ready to learn?`
          : "Ready to learn?"}
      </h1>

      {/* Action Cards */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 justify-center mb-6 w-full max-w-2xl">
        {actions.map(({ id, icon: Icon, label, sublabel }) => {
          const isActive = activeAction === id;
          return (
            <button
              key={id}
              onClick={() => handleActionClick(id)}
              className={`
                flex flex-col items-start gap-2 p-4 rounded-3xl transition-all duration-200 cursor-pointer
                sm:min-w-32.5 flex-1
                border border-border/50
                ${
                  isActive
                    ? "bg-primary/15 border-primary/40 shadow-lg shadow-primary/10"
                    : "bg-muted/40 hover:bg-muted/70 hover:border-border"
                }
              `}>
              <Icon
                className={`w-5 h-5 ${isActive ? "text-primary" : "text-foreground/70"}`}
              />
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">{sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Dialog */}
      <Dialog
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveAction(null);
          }
        }}>
        <DialogContent className="z-80 sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {activeAction === "link" && (
                <>
                  <Link2 className="w-4 h-4" /> Add a Link
                </>
              )}
              {activeAction === "paste" && (
                <>
                  <ClipboardPaste className="w-4 h-4" /> Paste Text
                </>
              )}
              {activeAction === "upload" && (
                <>
                  <Upload className="w-4 h-4" /> Upload File
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {activeAction === "link" && (
            <div className="flex gap-2 items-center mt-2">
              <Input
                autoFocus
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="Paste a YouTube link or website URL…"
                className="flex-1 rounded-2xl"
                onKeyDown={(e) =>
                  e.key === "Enter" && linkValue.trim() && handleSubmit()
                }
              />
              <button
                onClick={handleSubmit}
                disabled={!linkValue.trim() || isNavigating}
                className="shrink-0 h-9 w-9 rounded-full bg-foreground flex items-center justify-center disabled:opacity-40 transition-opacity">
                {isNavigating ? (
                  <Loader2 className="h-4 w-4 text-background animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-background" />
                )}
              </button>
            </div>
          )}

          {activeAction === "paste" && (
            <div className="flex flex-col gap-3 mt-2">
              <textarea
                autoFocus
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="Paste your text here…"
                rows={6}
                className="w-full bg-muted/40 border border-border/50 rounded-2xl p-3 resize-none text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={!pasteValue.trim() || isNavigating}
                  className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center disabled:opacity-40 transition-opacity">
                  {isNavigating ? (
                    <Loader2 className="h-4 w-4 text-background animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-background" />
                  )}
                </button>
              </div>
            </div>
          )}

          {activeAction === "upload" && (
            <div className="flex flex-col gap-4 mt-2">
              {selectedFile ? (
                <div className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl p-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground flex-1 truncate">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 bg-muted/40 border border-dashed border-border rounded-2xl p-8 hover:bg-muted/60 hover:border-primary/40 transition-all cursor-pointer">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to choose a file
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    PDF, images, audio, video, text
                  </span>
                </button>
              )}
              {selectedFile && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={isNavigating}
                    className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center disabled:opacity-40 transition-opacity">
                    {isNavigating ? (
                      <Loader2 className="h-4 w-4 text-background animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4 text-background" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick text input */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-3xl px-5 py-3 selection">
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Learn stuff…"
            className="flex-1 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            onKeyDown={(e) =>
              e.key === "Enter" && quickInput.trim() && handleQuickSend()
            }
          />
          <button
            onClick={handleQuickSend}
            disabled={!quickInput.trim() || isNavigating}
            className="h-8 w-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0">
            {isNavigating ? (
              <Loader2 className="h-4 w-4 text-background animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4 text-background" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
