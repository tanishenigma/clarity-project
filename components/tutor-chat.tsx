"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Importing your UI components
import { ChatMessages } from "@/components/chat-components/ChatMessages";
import { ChatInput } from "@/components/chat-components/ChatInput";
import { Message } from "@/components/chat-components/types";

// Types specific to the Tutor functionality
interface ContentItem {
  _id: string;
  title: string;
  type: string;
  source?: { url?: string };
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
  // We keep conversationId to maintain the current session context with the backend
  const [conversationId, setConversationId] = useState(initialConvId || "");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);

  // RAG / Context State
  const [spaceContent, setSpaceContent] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether the initialMessage has already been sent
  const sentInitialRef = useRef(false);

  const focusInput = () => {
    textareaRef.current?.focus();
  };

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

  // 2. Load Messages for Current Conversation (if ID exists)
  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
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
                toolsUsed: msg.toolsUsed,
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

  // Auto-send initialMessage once when provided (e.g. from mindmap root click)
  useEffect(() => {
    if (initialMessage && !sentInitialRef.current) {
      sentInitialRef.current = true;
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

      console.log("API Response:", {
        hasResponse: !!data.response,
        hasGraphUpdate: !!data.graphUpdate,
        hasFeeback: !!data.feedbackLog,
        toolsUsed: data.toolsUsed,
        graphUpdate: data.graphUpdate,
      });

      // Create assistant message with graph and feedback data
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_response`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
        graphUpdate: data.graphUpdate,
        feedbackLog: data.feedbackLog,
      };

      console.log("Created message:", {
        hasGraphUpdate: !!assistantMessage.graphUpdate,
        graphData: assistantMessage.graphUpdate,
      });

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
      setIsGeneratingGraph(false);

      // Update conversation ID if it was created
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (error) {
      console.error("Error:", error);
      setIsGeneratingGraph(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setIsTyping(false);
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
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-linear-to-br from-background via-muted/10 to-background">
      {/* Main Chat Area (Full Width, No Header) */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
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
          />
        </div>

        <div className="shrink-0 bg-background z-10">
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
          />
        </div>
      </div>
    </div>
  );
}
