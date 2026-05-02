"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  History,
  PanelRight,
  Loader2,
  Lock,
  LogIn,
  RotateCcw,
  Upload,
  PlusCircle,
  Plus,
} from "lucide-react";
import { ChatSidebar } from "@/components/chat-components/ChatSidebar";
import { ChatMessages } from "@/components/chat-components/ChatMessages";
import { ChatInput } from "@/components/chat-components/ChatInput";
import { Message, Conversation } from "@/components/chat-components/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ChatPage() {
  const { user, loading: userLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("chat:lastConversationId") ?? "";
    }
    return "";
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [autoSendPending, setAutoSendPending] = useState(false);
  const [quotedText, setQuotedText] = useState<string | null>(null);

  const sendMessageCallbackRef = useRef<() => Promise<void>>(async () => {});
  const skipAutoSelectRef = useRef(false);
  const skipLoadConversationRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    if (!user || userLoading) return;
    const prefill = sessionStorage.getItem("chat:prefill");
    const pendingFileInfo = sessionStorage.getItem("chat:pendingFile");
    if (!prefill && !pendingFileInfo) return;
    if (sessionStorage.getItem("chat:new")) {
      skipAutoSelectRef.current = true;
      sessionStorage.removeItem("chat:new");
    }
    sessionStorage.removeItem("chat:prefill");
    sessionStorage.removeItem("chat:pendingFile");
    if (prefill) setInput(prefill);
    const pendingFile = (window as any).__pendingChatFile as File | undefined;
    if (pendingFile) {
      setUploadedFiles([pendingFile]);
      delete (window as any).__pendingChatFile;
    }
    setAutoSendPending(true);
  }, [user, userLoading]);

  useEffect(() => {
    if (!autoSendPending) return;
    setAutoSendPending(false);
    setConversationId("");
    setMessages([]);
    const timer = setTimeout(() => sendMessageCallbackRef.current(), 200);
    return () => clearTimeout(timer);
  }, [autoSendPending]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);

  // Mirror the graph-keyword list from the API route for client-side detection
  const graphKeywords = [
    "graph",
    "plot",
    "visualize",
    "draw",
    "sketch",
    "parabola",
    "chart",
    "y=",
    "f(x)=",
    "x^2",
  ];
  // Explicit negation: user is asking NOT to generate a graph
  const graphNegationPattern =
    /\b(without|no|don'?t|do not|not|skip|avoid|just|only|instead)\b.{0,30}\b(graph|plot|draw|visualize|diagram|chart|waveform)\b|\b(graph|plot|draw|visualize|diagram|chart|waveform)\b.{0,20}\b(not|without|no need)\b/i;
  const regeneratePattern =
    /\b(regenerate|redo|again|redraw|re-?generate|show again)\b/i;
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      try {
        const response = await fetch(
          `/api/chat/conversations?userId=${user.id}`,
        );
        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
          if (
            !conversationId &&
            !skipAutoSelectRef.current &&
            data.conversations &&
            data.conversations.length > 0
          ) {
            // Restore last viewed conversation; fall back to most recent
            const saved = localStorage.getItem("chat:lastConversationId");
            const exists =
              saved &&
              data.conversations.some((c: Conversation) => c._id === saved);
            setConversationId(exists ? saved! : data.conversations[0]._id);
          }
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Load conversation messages
  useEffect(() => {
    const loadConversation = async () => {
      if (skipLoadConversationRef.current) {
        skipLoadConversationRef.current = false;
        return;
      }

      if (!conversationId || conversationId.length !== 24) {
        setMessages([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/chat/conversations/${conversationId}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map((msg: any, index: number) => ({
                id: `msg_${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp || Date.now()),
                files: msg.files,
                graphUpdate: msg.graphUpdate,
                feedbackLog: msg.feedbackLog,
              })),
            );
          } else {
            setMessages([]);
          }
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        setMessages([]);
      }
    };

    loadConversation();
  }, [conversationId]);

  const handleNewConversation = () => {
    localStorage.removeItem("chat:lastConversationId");
    setConversationId("");
    setMessages([]);
  };

  const handleSelectConversation = (convId: string) => {
    localStorage.setItem("chat:lastConversationId", convId);
    setConversationId(convId);
    setLoading(false);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      const response = await fetch(
        `/api/chat/conversations?conversationId=${convId}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c._id !== convId));
        if (convId === conversationId) {
          setConversationId("");
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.type === "application/pdf" ||
        file.type.startsWith("image/") ||
        file.type === "text/plain";
      const isValidSize = file.size <= 10 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...validFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.type === "application/pdf" ||
        file.type.startsWith("image/") ||
        file.type === "text/plain";
      const isValidSize = file.size <= 10 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...validFiles]);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0 && !quotedText) return;
    if (!user) return;

    const currentConvId = conversationId;

    const filesToSend = uploadedFiles;
    // Build message content: prepend quote if present
    const baseContent =
      input || (filesToSend.length > 0 ? "Uploaded files for analysis" : "");
    const fullContent = quotedText
      ? `"${quotedText}"${baseContent ? `\n\n${baseContent}` : ""}`
      : baseContent;
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: fullContent,
      timestamp: new Date(),
      files: filesToSend.map((f) => ({ name: f.name, type: f.type })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setQuotedText(null);
    setUploadedFiles([]);
    setLoading(true);
    setIsTyping(true);

    // Detect if a graph will be generated so we can show the right indicator
    const msgLower = fullContent.toLowerCase();
    const graphIntentDetected =
      !graphNegationPattern.test(fullContent) &&
      (graphKeywords.some((kw) => msgLower.includes(kw)) ||
        /[xy]=|f\([^)]+\)|[xy]\^|\\?sin|\\?cos|\\?tan/i.test(fullContent) ||
        (regeneratePattern.test(fullContent) &&
          messages
            .slice(-6)
            .some((m) =>
              graphKeywords.some((kw) =>
                (m.content || "").toLowerCase().includes(kw),
              ),
            )));
    if (graphIntentDetected) setIsGeneratingGraph(true);

    // Optimistically add a placeholder conversation entry for new chats
    const optimisticId = `__optimistic__${Date.now()}`;
    const optimisticTitle =
      (input || (quotedText ? `"${quotedText}"` : "") || "Uploaded files")
        .trim()
        .substring(0, 50) || "New Conversation";
    if (!currentConvId) {
      setConversations((prev) => [
        {
          _id: optimisticId,
          title: optimisticTitle,
          preview: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    try {
      let response: Response;

      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", fullContent);
        formData.append("conversationId", currentConvId);
        formData.append("userId", user.id);
        filesToSend.forEach((file) => {
          formData.append("files", file);
        });

        response = await fetch("/api/chat/global", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/chat/global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: fullContent,
            conversationId: currentConvId,
            userId: user.id,
          }),
        });
      }

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const returnedConvId = response.headers.get("X-Conversation-Id");
      const isNewConv =
        response.headers.get("X-Is-New-Conversation") === "true";

      // Replace the optimistic placeholder with the real ID immediately
      if (isNewConv && returnedConvId) {
        setConversations((prev) =>
          prev.map((c) =>
            c._id === optimisticId ? { ...c, _id: returnedConvId } : c,
          ),
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let assistantContent = "";
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-response`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
      const tokenQueue: string[] = [];
      let displayedContent = "";
      let graphMarkerSeen = false;

      const drainInterval = setInterval(() => {
        if (tokenQueue.length === 0) return;
        displayedContent += tokenQueue.shift()!;
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.map((m) => m.role).lastIndexOf("assistant");
          if (lastIdx >= 0) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: displayedContent,
            };
          }
          return updated;
        });
      }, 25);

      const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        if (!graphMarkerSeen) {
          if (assistantContent.includes("\n__GRAPH__:")) {
            graphMarkerSeen = true;
            // Only show text up to the graph marker; replace any queued chunks
            const textPart = assistantContent.split("\n__GRAPH__:")[0];
            const remaining = textPart.slice(displayedContent.length);
            tokenQueue.length = 0;
            if (remaining) tokenQueue.push(remaining);
          } else {
            tokenQueue.push(chunk);
          }
        }
      }

      // Flush remaining decoder bytes
      assistantContent += decoder.decode();

      // Wait for the token queue to fully drain before graph parsing
      await new Promise<void>((resolve) => {
        const checkDrain = setInterval(() => {
          if (tokenQueue.length === 0) {
            clearInterval(checkDrain);
            clearInterval(drainInterval);
            resolve();
          }
        }, 30);
      });

      // After stream ends, parse out graph marker if present
      if (assistantContent.includes("\n__GRAPH__:")) {
        const [textPart, graphPart] = assistantContent.split("\n__GRAPH__:");
        try {
          const { finalGraph, conversationLog } = JSON.parse(graphPart);
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.map((m) => m.role).lastIndexOf("assistant");
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: textPart,
                graphUpdate: finalGraph,
                feedbackLog: conversationLog,
              };
            }
            return updated;
          });
        } catch (e) {
          console.error("Failed to parse graph data:", e);
        } finally {
          setIsGeneratingGraph(false);
        }
      } else {
        setIsGeneratingGraph(false);
      }

      if (returnedConvId && !currentConvId) {
        skipLoadConversationRef.current = true;
        localStorage.setItem("chat:lastConversationId", returnedConvId);
        setConversationId(returnedConvId);
      }

      // Refresh conversations list
      const listResponse = await fetch(
        `/api/chat/conversations?userId=${user.id}`,
      );
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setConversations(listData.conversations || []);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsGeneratingGraph(false);
      // Remove the optimistic placeholder if the request failed
      setConversations((prev) =>
        prev.filter((c) => !c._id.startsWith("__optimistic__")),
      );
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const focusInput = () => {
    textareaRef.current?.focus();
  };

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-br from-background via-muted/20 to-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-top h-screen space-y-4 py-20.5">
        <Card className="w-full max-w-md text-center shadow-lg">
          <div className="flex justify-center mb-6">
            <div className="bg-muted p-4 rounded-full">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Login Required
          </h2>
          <p className="text-muted-foreground mb-8">
            Please log in to access the AI chat Tutoring assistant.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth" className="w-full">
              <Button className="w-full">
                {" "}
                <LogIn className="w-4 h-4" />
                Sign In or Register
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  sendMessageCallbackRef.current = handleSendMessage;

  const hasMessages = messages.length > 0;
  return (
    <div
      className="relative flex h-dvh overflow-hidden -mt-24 -mx-4 -mb-6 sm:-mt-16 sm:-mx-6 sm:-mb-6 md:-m-8 pt-12 md:pt-0 bg-linear-to-br from-background via-muted/10 to-background"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}>
      {/* Full-page drag overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/60 pointer-events-none">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground text-center">
            Drop files here
          </p>
          <p className="text-sm text-muted-foreground text-center">
            PDF, images, or text files · max 10 MB each
          </p>
        </div>
      )}
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="shrink-0 px-3 py-2 flex items-center justify-end border-b border-border/50">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Open chat history">
            <History className="h-5 w-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            {hasMessages && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
                className="gap-2 shrink-0 hidden md:inline-flex items-center">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            )}
            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 duration-1000 ease-in-out transition-all"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}>
              <PanelRight className="h-5 w-5 cursor-pointer" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 relative scroll-smooth">
          <ChatMessages
            messages={messages}
            isTyping={isTyping}
            isGeneratingGraph={isGeneratingGraph}
            userName={user?.username}
            dragActive={dragActive}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            setInput={setInput}
            focusInput={focusInput}
            onQuote={setQuotedText}
          />
        </div>
        <div className="shrink-0 z-10  md:pb-0">
          <ChatInput
            input={input}
            setInput={setInput}
            uploadedFiles={uploadedFiles}
            onRemoveFile={removeFile}
            onFileSelect={handleFileSelect}
            onSend={handleSendMessage}
            loading={loading}
            fileInputRef={fileInputRef}
            textareaRef={textareaRef}
            quotedText={quotedText ?? undefined}
            onRemoveQuote={() => setQuotedText(null)}
          />
        </div>
      </div>
      <ChatSidebar
        isOpen={sidebarOpen}
        conversations={conversations}
        loading={loadingConversations}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeConversationId={conversationId}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Mobile backdrop — closes sidebar when tapping chat area */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
