import { useRef, useEffect, useState, useCallback } from "react";
import { Quote, Upload } from "lucide-react";
import { MessageBubble } from "../chat-components/MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { EmptyState } from "./EmptyState";
import { GraphViewer } from "@/components/chat-components/GraphViewer";
import { FeedbackLog } from "@/components/chat-components/FeedbackLog";
import { Message } from "../chat-components/types";

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
  isGeneratingGraph?: boolean;
  userName?: string;
  dragActive: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isSidebarOpen?: boolean;
  setInput: (value: string) => void; // Fixed: should be a function
  focusInput: () => void; // Fixed: should be a function
  onQuote?: (text: string) => void;
}

export function ChatMessages({
  messages,
  isTyping,
  isGeneratingGraph,
  userName,
  dragActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  setInput,
  focusInput,
  onQuote,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragContainerRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectionData, setSelectionData] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [highlightRects, setHighlightRects] = useState<
    {
      left: number;
      top: number;
      width: number;
      height: number;
    }[]
  >([]);

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      const range = selection?.getRangeAt(0);
      const boundingRect = range?.getBoundingClientRect();
      if (boundingRect && range) {
        const container = dragContainerRef.current;
        const containerRect = container?.getBoundingClientRect();
        const scrollTop = container?.scrollTop ?? 0;
        const scrollLeft = container?.scrollLeft ?? 0;

        // Convert every line rect from viewport-fixed to scroll-container-absolute
        const rects = Array.from(range.getClientRects()).map((r) => ({
          left: r.left - (containerRect?.left ?? 0) + scrollLeft,
          top: r.top - (containerRect?.top ?? 0) + scrollTop,
          width: r.width,
          height: r.height,
        }));

        savedRangeRef.current = range.cloneRange();
        setHighlightRects(rects);
        setSelectionData({
          text,
          // Also convert button anchor to container-absolute
          x:
            boundingRect.left +
            boundingRect.width / 2 -
            (containerRect?.left ?? 0) +
            scrollLeft,
          y: boundingRect.top - (containerRect?.top ?? 0) + scrollTop,
        });
        selection?.removeAllRanges();
      }
    } else {
      savedRangeRef.current = null;
      setHighlightRects([]);
      setSelectionData(null);
    }
  };

  const handleAskAI = (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectionData) {
      if (onQuote) {
        onQuote(selectionData.text);
      } else {
        setInput(`"${selectionData.text}" `);
      }

      savedRangeRef.current = null;
      window.getSelection()?.removeAllRanges();
      setHighlightRects([]);
      setSelectionData(null);
      focusInput();
    }
  };

  return (
    <div
      ref={dragContainerRef}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseUp={handleMouseUp}
      className="relative flex-1 overflow-y-auto min-h-0">
      {/* Custom selection highlight overlay — absolute so it scrolls with content */}
      {highlightRects.map((rect, i) => (
        <div
          key={i}
          className="absolute pointer-events-none z-40 bg-primary/25 rounded-sm"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
      {/* Floating Selection Menu — absolute so it scrolls with the text */}
      {selectionData && (
        <div
          onMouseUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-200"
          style={{ left: selectionData.x, top: selectionData.y - 8 }}>
          <button
            onMouseDown={(e) => e.preventDefault()} // belt-and-suspenders: keep selection alive
            onClick={handleAskAI}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-xl hover:bg-primary/90 transition-all border border-primary-foreground/10">
            <Quote className="h-4 w-4" />
            <span className="text-sm font-semibold">Ask AI</span>
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            return (
              <div key={msg.id} className="space-y-3">
                <MessageBubble
                  message={msg}
                  userName={userName}
                  isStreaming={
                    isTyping && isLastMessage && msg.role === "assistant"
                  }
                  isCollapsed={collapsedIds.has(msg.id)}
                  onToggleCollapse={() => toggleCollapsed(msg.id)}
                />

                {/* Show graph if available — hidden when message is collapsed */}
                {msg.graphUpdate && !collapsedIds.has(msg.id) && (
                  <div className="w-full flex justify-center">
                    <GraphViewer
                      graphData={msg.graphUpdate}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Show feedback log if available — hidden when message is collapsed */}
                {/* {msg.feedbackLog &&
                  msg.feedbackLog.length > 0 &&
                  !collapsedIds.has(msg.id) && (
                    <div className="w-full">
                      <FeedbackLog feedbackLog={msg.feedbackLog} />
                    </div>
                  )} */}
              </div>
            );
          })}

          {(isTyping || isGeneratingGraph) && (
            <TypingIndicator
              isGeneratingGraph={isGeneratingGraph && !isTyping}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
