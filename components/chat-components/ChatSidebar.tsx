import { History, Plus, Search, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationCard } from "./ConversationCard";
import { Conversation } from "../chat-components/types";
import { motion, AnimatePresence } from "motion/react"; // Added Framer Motion

interface ChatSidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeConversationId: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void;
}

export function ChatSidebar({
  isOpen,
  conversations,
  loading,
  searchQuery,
  setSearchQuery,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onClose,
}: ChatSidebarProps) {
  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0, x: 20 }}
          animate={{ width: "auto", opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 20 }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: 0.5,
          }}
          className="absolute inset-y-0 right-0 z-30 md:relative md:z-auto flex-shrink-0 overflow-hidden bg-card/50 backdrop-blur-sm border-l border-border/50 shadow-xl md:shadow-none ">
          <div className="w-72 md:w-80 flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-border/50 p-4 bg-card/80 shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Chat History</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={onNewConversation}
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
                  title="Start new conversation">
                  <Plus className="h-4 w-4" />
                  New
                </Button>
                {onClose && (
                  <Button
                    onClick={onClose}
                    size="icon"
                    variant="ghost"
                    className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Close sidebar">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground selection" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0 scrollbar-thin">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {searchQuery
                      ? "No conversations found"
                      : "No conversations yet"}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-muted-foreground">
                      Start a new chat to begin!
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map((conv) => (
                    <ConversationCard
                      key={conv._id}
                      conversation={conv}
                      isActive={activeConversationId === conv._id}
                      onSelect={onSelectConversation}
                      onDelete={onDeleteConversation}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
