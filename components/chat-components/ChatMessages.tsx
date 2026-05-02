import { useRef, useEffect, useState, useCallback } from "react";
import { Quote, Upload } from "lucide-react";
import { MessageBubble } from "../chat-components/MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { EmptyState } from "./EmptyState";
import { GraphViewer } from "@/components/chat-components/GraphViewer";
import { FeedbackLog } from "@/components/chat-components/FeedbackLog";
import { Message } from "../chat-components/types";
import type { Citation } from "../chat-components/types";

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
  setInput: (value: string) => void;
  focusInput: () => void;
  onQuote?: (text: string) => void;
  onCitationClick?: (citation: Citation) => void;
  onStudyPromptSubmit?: (reply: string) => void;
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
  onCitationClick,
  onStudyPromptSubmit,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragContainerRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectionData, setSelectionData] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

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

  // Dismiss Ask AI button when clicking elsewhere
  useEffect(() => {
    if (!selectionData) return;
    const dismiss = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-ask-ai-button]")) {
        setSelectionData(null);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [selectionData]);

  // Use document-level mouseup so it fires even when the mouse is released
  // outside the scroll container (common with scrollable overflow parents).
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (!text || text.length === 0) {
        setSelectionData(null);
        return;
      }

      const range = selection?.getRangeAt(0);
      if (!range) {
        setSelectionData(null);
        return;
      }

      // Only show Ask AI when selection is inside an assistant message
      let node: Node | null = range.commonAncestorContainer;
      let inAssistant = false;
      while (node) {
        if (
          node instanceof Element &&
          node.hasAttribute("data-assistant-content")
        ) {
          inAssistant = true;
          break;
        }
        node = node.parentNode;
      }

      if (!inAssistant) {
        setSelectionData(null);
        return;
      }

      // Position button above the selection using viewport-fixed coords
      const rect = range.getBoundingClientRect();
      setSelectionData({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleMouseUp = () => {
    /* handled by document listener above */
  };

  const handleAskAI = (e: React.MouseEvent) => {
    e.preventDefault();

    if (selectionData) {
      if (onQuote) {
        onQuote(selectionData.text);
      } else {
        setInput(`"${selectionData.text}" `);
      }

      window.getSelection()?.removeAllRanges();
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
      {/* Ask AI floating button — fixed to viewport so it doesn't shift on scroll */}
      {selectionData && (
        <div
          data-ask-ai-button
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-50 -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-200"
          style={{ left: selectionData.x, top: selectionData.y - 8 }}>
          <button
            onMouseDown={(e) => e.preventDefault()}
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
                  onCitationClick={onCitationClick}
                  onStudyPromptSubmit={onStudyPromptSubmit}
                  canInteractWithStudyPrompt={
                    isLastMessage && !isTyping && !isGeneratingGraph
                  }
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
