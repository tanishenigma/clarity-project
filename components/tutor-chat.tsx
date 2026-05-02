"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, GripVertical, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Importing your UI components
import { ChatMessages } from "@/components/chat-components/ChatMessages";
import { ChatInput } from "@/components/chat-components/ChatInput";
import { Message } from "@/components/chat-components/types";
import type { Citation } from "@/components/chat-components/types";

const PdfPanel = dynamic(
  () => import("@/components/PdfPanel").then((module) => module.PdfPanel),
  {
    ssr: false,
  },
);

// Types specific to the Tutor functionality
interface ContentItem {
  _id: string;
  title: string;
  type: string;
  source?: { url?: string };
}

interface PersistedMessage extends Omit<Message, "timestamp"> {
  timestamp: string;
}

const STUDY_PROMPT_PREFIXES = [
  "I can generate flashcards for this study space.",
  "I can generate a quiz for this study space.",
];

function isStudyGenerationPromptResponse(content: string) {
  return STUDY_PROMPT_PREFIXES.some((prefix) => content.startsWith(prefix));
}

function normalizeTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\.(pdf|docx?|pptx?)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface TutorChatProps {
  spaceId: string;
  userId: string;
  conversationId?: string;
  /** When supplied, auto-sends this message as the first user turn */
  initialMessage?: string;
}

// Simple client-side text similarity for RAG (Retrieval-Augmented Generation)
function getRelevantContent(
  query: string,
  contents: ContentItem[],
): ContentItem[] {
  if (!contents || contents.length === 0) return [];

  const queryWords = query.toLowerCase().split(/\s+/);
  const scored = contents.map((content) => {
    const title = content.title.toLowerCase();
    const score = queryWords.filter((word) => title.includes(word)).length;
    return { content, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Top 3 most relevant items
    .map((item) => item.content);
}

export function TutorChat({
  spaceId,
  userId,
  conversationId: initialConvId,
  initialMessage,
}: TutorChatProps) {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Persist conversationId per-space so the chat survives a page refresh
  const storageKey = `tutor-chat:${spaceId}:conversationId`;
  const [conversationId, setConversationId] = useState<string>(
    initialConvId ?? "",
  );
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [isClearingChats, setIsClearingChats] = useState(false);
  const [clearChatsError, setClearChatsError] = useState<string | null>(null);

  // RAG / Context State
  const [spaceContent, setSpaceContent] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);

  // PDF Viewer State
  const [activePdf, setActivePdf] = useState<{
    url: string;
    title: string;
    snippet: string;
  } | null>(null);
  const [pdfWidth, setPdfWidth] = useState(460);
  const isDraggingRef = useRef(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  const resolveCitationUrl = useCallback(
    (citation: Citation) => {
      if (citation.url) return citation.url;

      const byId = citation.contentId
        ? spaceContent.find(
            (item) => item.type === "pdf" && item._id === citation.contentId,
          )
        : undefined;
      if (byId?.source?.url) return byId.source.url;

      const normalizedCitationTitle = normalizeTitle(citation.title);
      const byTitle = spaceContent.find(
        (item) =>
          item.type === "pdf" &&
          item.source?.url &&
          normalizeTitle(item.title) === normalizedCitationTitle,
      );
      return byTitle?.source?.url ?? "";
    },
    [spaceContent],
  );

  const getMessagesCacheKey = useCallback(
    (convId: string) => `tutor-chat:${spaceId}:messages:${convId}`,
    [spaceId],
  );

  const hydrateCitations = useCallback(
    (citations: Citation[] | undefined) =>
      (citations ?? []).map((citation) => ({
        ...citation,
        url: resolveCitationUrl(citation),
      })),
    [resolveCitationUrl],
  );

  const hydrateMessage = useCallback(
    (msg: any, index: number): Message => ({
      id: msg.id ?? `msg_${index}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()),
      files: msg.files,
      toolsUsed: msg.toolsUsed,
      graphUpdate: msg.graphUpdate,
      feedbackLog: msg.feedbackLog,
      citations: hydrateCitations(msg.citations),
    }),
    [hydrateCitations],
  );

  const readCachedMessages = useCallback(
    (convId: string): Message[] => {
      if (!convId) return [];
      try {
        const raw = localStorage.getItem(getMessagesCacheKey(convId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as PersistedMessage[];
        if (!Array.isArray(parsed)) return [];
        return parsed.map((msg, index) => hydrateMessage(msg, index));
      } catch (error) {
        console.error("Error reading cached chat messages:", error);
        return [];
      }
    },
    [getMessagesCacheKey, hydrateMessage],
  );

  const mergeMessagesWithCache = useCallback(
    (serverMessages: Message[], cachedMessages: Message[]) =>
      serverMessages.map((message, index) => {
        const cached = cachedMessages[index];
        if (!cached) return message;

        const serverHasCitations = (message.citations?.length ?? 0) > 0;
        const cachedHasCitations = (cached.citations?.length ?? 0) > 0;
        const isSameMessage =
          cached.role === message.role && cached.content === message.content;

        if (!serverHasCitations && cachedHasCitations && isSameMessage) {
          return {
            ...message,
            citations: hydrateCitations(cached.citations),
          };
        }

        return message;
      }),
    [hydrateCitations],
  );

  const handleCitationClick = useCallback(
    (citation: Citation) => {
      const resolvedUrl = resolveCitationUrl(citation);
      if (!resolvedUrl) return;

      setActivePdf({
        url: resolvedUrl,
        title: citation.title,
        snippet: citation.snippet,
      });
    },
    [resolveCitationUrl],
  );

  const clearCachedConversations = useCallback(() => {
    const messagesPrefix = `tutor-chat:${spaceId}:messages:`;
    const keysToRemove: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(messagesPrefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(storageKey);
  }, [spaceId, storageKey]);

  const handleClearChats = useCallback(async () => {
    setIsClearingChats(true);
    setClearChatsError(null);

    try {
      const searchParams = new URLSearchParams({ userId, spaceId });
      const response = await fetch(`/api/conversations?${searchParams}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear chat history");
      }

      clearCachedConversations();
      setMessages([]);
      setInput("");
      setUploadedFiles([]);
      setConversationId("");
      setActivePdf(null);
    } catch (error) {
      console.error("Error clearing chats:", error);
      setClearChatsError("Could not clear the chat history. Please try again.");
    } finally {
      setIsClearingChats(false);
    }
  }, [clearCachedConversations, spaceId, userId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track the last initialMessage that was sent to avoid duplicates but allow new topics
  const lastSentInitialMessage = useRef<string | undefined>(undefined);

  const focusInput = () => {
    textareaRef.current?.focus();
  };

  // Resizer drag handlers
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !layoutRef.current) return;
      const containerRect = layoutRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - ev.clientX;
      const minW = 280;
      const maxW = containerRect.width * 0.7;
      setPdfWidth(Math.min(maxW, Math.max(minW, newWidth)));
    };

    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // 1. Fetch Space Content (The Context)
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/spaces/${spaceId}`);
        if (response.ok) {
          const data = await response.json();
          setSpaceContent(data.content || []);
        }
      } catch (error) {
        console.error("Error fetching space content:", error);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchContent();
  }, [spaceId]);

  // 1b. Resolve conversationId from DB when localStorage has no entry for this space
  useEffect(() => {
    if (conversationId || !userId) return;
    // First try localStorage (SSR can't read it, so we do it here after hydration)
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setConversationId(stored);
      return;
    }
    // Fall back to DB lookup for the active conversation
    fetch(`/api/conversations?userId=${userId}&spaceId=${spaceId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const active = (data.conversations || []).find(
          (c: { _id: string; active?: boolean }) => c.active !== false,
        );
        if (active) {
          localStorage.setItem(storageKey, active._id);
          setConversationId(active._id);
        }
      })
      .catch((err) => console.error("Error resolving conversation:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Load Messages for Current Conversation (if ID exists)
  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      const cachedMessages = readCachedMessages(conversationId);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }

      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            const serverMessages = data.messages.map(
              (msg: any, index: number) => hydrateMessage(msg, index),
            );
            setMessages(mergeMessagesWithCache(serverMessages, cachedMessages));
          } else {
            setMessages(cachedMessages);
          }
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        setMessages(cachedMessages);
      }
    };
    loadConversation();
  }, [
    conversationId,
    hydrateMessage,
    mergeMessagesWithCache,
    readCachedMessages,
  ]);

  useEffect(() => {
    if (!conversationId) return;

    try {
      const persistedMessages: PersistedMessage[] = messages.map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
      }));
      localStorage.setItem(
        getMessagesCacheKey(conversationId),
        JSON.stringify(persistedMessages),
      );
    } catch (error) {
      console.error("Error caching chat messages:", error);
    }
  }, [conversationId, getMessagesCacheKey, messages]);

  // Auto-send initialMessage when it changes (e.g. from mindmap node click navigating to chat)
  useEffect(() => {
    if (initialMessage && initialMessage !== lastSentInitialMessage.current) {
      lastSentInitialMessage.current = initialMessage;
      const timer = setTimeout(() => {
        handleSendMessage(initialMessage);
      }, 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText ?? input;
    if (!textToSend.trim() && uploadedFiles.length === 0) return;

    // Create User Message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content:
        textToSend ||
        (uploadedFiles.length > 0 ? "Uploaded files for analysis" : ""),
      timestamp: new Date(),
      files: uploadedFiles.map((f) => ({ name: f.name, type: f.type })),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setInput("");
    setUploadedFiles([]);
    setLoading(true);
    setIsTyping(true);

    // Detect if a graph will be generated so we can show the right indicator.
    const graphKeywords = [
      "graph",
      "plot",
      "visualize",
      "draw",
      "sketch",
      "chart",
      "waveform",
      "diagram",
      "curve",
      "show",
      "y=",
      "f(x)",
    ];
    const queryLower = (userMessage.content || "").toLowerCase();
    const willGraph = graphKeywords.some((kw) => queryLower.includes(kw));
    if (willGraph) setIsGeneratingGraph(true);

    try {
      const relevantContent = getRelevantContent(textToSend, spaceContent);
      const contentContext = relevantContent.map((c) => c.title).join(", ");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery: userMessage.content,
          spaceId,
          userId,
          conversationId,
          contentContext: contentContext || undefined, // Injecting the context
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      const fullContent: string = data.response ?? "";
      const isStudyPromptResponse =
        isStudyGenerationPromptResponse(fullContent);

      // Placeholder message — content filled word-by-word below
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_response`,
        role: "assistant",
        content: isStudyPromptResponse ? fullContent : "",
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
        graphUpdate: isStudyPromptResponse ? data.graphUpdate : undefined,
        feedbackLog: isStudyPromptResponse ? data.feedbackLog : undefined,
        citations: hydrateCitations(data.citations),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
      setIsGeneratingGraph(false);

      // Update conversation ID if it was created
      if (data.conversationId && !conversationId) {
        localStorage.setItem(storageKey, data.conversationId);
        setConversationId(data.conversationId);
      }

      if (isStudyPromptResponse) {
        setLoading(false);
        return;
      }

      // Word-by-word reveal
      const words = fullContent.match(/\S+\s*/g) ?? [fullContent];
      let wordIdx = 0;
      let displayed = "";

      const wordInterval = setInterval(() => {
        if (wordIdx >= words.length) {
          clearInterval(wordInterval);
          // Flush final state with graph/feedback data
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.map((m) => m.role).lastIndexOf("assistant");
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: fullContent,
                graphUpdate: data.graphUpdate,
                feedbackLog: data.feedbackLog,
                citations: hydrateCitations(data.citations),
              };
            }
            return updated;
          });
          setLoading(false);
          return;
        }
        displayed += words[wordIdx++];
        const snap = displayed;
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.map((m) => m.role).lastIndexOf("assistant");
          if (lastIdx >= 0) {
            updated[lastIdx] = { ...updated[lastIdx], content: snap };
          }
          return updated;
        });
      }, 35);
    } catch (error) {
      console.error("Error:", error);
      setIsGeneratingGraph(false);
      setLoading(false);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content:
            "Switched to local agent — the server is temporarily unavailable. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  // --- File & Drag Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => file.size <= 10 * 1024 * 1024);
    if (validFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...validFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setUploadedFiles([...uploadedFiles, ...files]);
  };

  // --- Render ---

  if (loadingContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading study context...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={layoutRef}
      className="flex h-full flex-1 min-h-0 items-stretch overflow-hidden bg-linear-to-br from-background via-muted/10 to-background">
      {/* Main Chat Area — min-w-0 so it can yield space to the PDF panel */}
      <div className="flex h-full flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Study Chat
              </p>
              <p className="text-xs text-muted-foreground">
                Clear previous chats here and start the next message from
                scratch.
              </p>
              {clearChatsError ? (
                <p className="mt-1 text-xs text-destructive">
                  {clearChatsError}
                </p>
              ) : null}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isClearingChats}
                  className="shrink-0">
                  {isClearingChats ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="h-4 w-4" />
                  )}
                  Fresh conversation
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Clear all chats in this space?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes every saved chat for this study
                    space. Your next message will start a brand-new
                    conversation.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearingChats}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearChats}
                    disabled={isClearingChats}
                    className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40">
                    {isClearingChats ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Clear chats
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 relative scroll-smooth">
          <ChatMessages
            messages={messages}
            isTyping={isTyping}
            isGeneratingGraph={isGeneratingGraph}
            userName={userId ? "User" : undefined}
            dragActive={dragActive}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            isSidebarOpen={false}
            setInput={setInput}
            focusInput={focusInput}
            onCitationClick={handleCitationClick}
            onStudyPromptSubmit={handleSendMessage}
          />
        </div>

        <div className="shrink-0 bg-background z-10">
          <ChatInput
            input={input}
            setInput={setInput}
            uploadedFiles={uploadedFiles}
            onRemoveFile={removeFile}
            onFileSelect={handleFileSelect}
            onSend={() => handleSendMessage()}
            loading={loading}
            fileInputRef={fileInputRef}
            textareaRef={textareaRef}
          />
        </div>
      </div>

      {/* Resizer + PDF panel */}
      {activePdf && (
        <>
          {/* Draggable divider */}
          <div
            onMouseDown={startResize}
            className="group relative h-full w-1.5 shrink-0 self-stretch cursor-col-resize bg-border/40 hover:bg-primary/40 transition-colors z-20 flex items-center justify-center">
            {/* Grip icon + close button — visible on hover */}
            <div className="absolute flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setActivePdf(null)}
                className="rounded-full bg-background border border-border shadow-md p-0.5 hover:bg-destructive hover:border-destructive hover:text-destructive-foreground transition-colors pointer-events-auto"
                aria-label="Close PDF panel">
                <X className="h-3 w-3" />
              </button>
              <GripVertical className="h-5 w-5 text-muted-foreground/60" />
            </div>
          </div>

          {/* PDF panel — dynamically sized */}
          <div
            className="shrink-0 flex h-full self-stretch flex-col min-h-0 overflow-hidden bg-background border-l border-border/40"
            style={{ width: pdfWidth }}>
            <PdfPanel
              url={activePdf.url}
              title={activePdf.title}
              onClose={() => setActivePdf(null)}
              onAskAI={(text, _mode) => {
                setInput(text);
                focusInput();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
