import { useRef, useEffect } from "react";
import {
  Send,
  Upload,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  ArrowUp,
  Paperclip,
  Quote,
} from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  uploadedFiles: File[];
  onRemoveFile: (index: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
  loading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  quotedText?: string;
  onRemoveQuote?: () => void;
}

export function ChatInput({
  input,
  setInput,
  uploadedFiles,
  onRemoveFile,
  onFileSelect,
  onSend,
  loading,
  fileInputRef,
  textareaRef,
  quotedText,
  onRemoveQuote,
}: ChatInputProps) {
  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;

      if (textareaRef.current.scrollHeight > 120) {
        textareaRef.current.style.overflowY = "auto";
      } else {
        textareaRef.current.style.overflowY = "hidden";
      }
    }
  }, [input]);

  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-4xl mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*,.txt"
          onChange={onFileSelect}
          className="hidden"
        />

        {/* Quote bubble — shown when text has been quoted from a message */}
        {quotedText && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/60 px-3 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 mb-2">
            <Quote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <p className="flex-1 text-xs text-foreground/80 line-clamp-3 leading-relaxed">
              {quotedText}
            </p>
            <button
              onClick={onRemoveQuote}
              className="shrink-0 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Single unified input box */}
        <div className="flex flex-col rounded-full border border-border/60 bg-muted/40  focus-within:none transition-all duration-200 shadow-md py-1 selection:bg-primary selection:text-primary-foreground">
          {/* Attached files row — shown inside the box when files present */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {uploadedFiles.map((file, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-background border border-border/50 text-xs font-medium text-foreground animate-in fade-in zoom-in-95 duration-200">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-3 w-3 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-3 w-3 text-warning shrink-0" />
                  )}
                  <span className="truncate max-w-32">{file.name}</span>
                  <button
                    onClick={() => onRemoveFile(idx)}
                    className="ml-0.5 h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive/15 hover:text-destructive transition-colors">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Textarea + action buttons row */}
          <div className="flex items-center gap-1 px-2 py-1">
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload files"
              className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ask a question or describe your files..."
              disabled={loading}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none md:text-sm   disabled:opacity-50"
              style={{
                minHeight: "36px",
                maxHeight: "120px",
                lineHeight: "1.5",
              }}
            />

            {/* Send Button */}
            <button
              onClick={() => onSend()}
              disabled={
                loading ||
                (!input.trim() && uploadedFiles.length === 0 && !quotedText)
              }
              className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                !input.trim() && uploadedFiles.length === 0 && !quotedText
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              }`}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-1.5 text-center opacity-60 hidden lg:block whitespace-nowrap">
          Press{" "}
          <kbd className="font-sans px-1 pt-0.5 bg-muted rounded border border-border">
            Enter
          </kbd>{" "}
          to send,{" "}
          <kbd className="font-sans px-1 pt-0.5 bg-muted rounded border border-border">
            Shift + Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}
