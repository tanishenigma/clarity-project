"use client";

import { useState, useEffect, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Upload, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { TutorChat } from "@/components/tutor-chat";

// Imports from the new components folder
import { SpaceData } from "@/components/spaces-components/types";
import { UploadModal } from "@/components/spaces-components/upload-modal";
import { ContentTab } from "@/components/spaces-components/content-tab";
import { FlashcardsTab } from "@/components/spaces-components/flashcards-tab";
import { QuizzesTab } from "@/components/spaces-components/quizzes-tab";
import { MindmapTab } from "@/components/spaces-components/mindmap-tab";
import { SummaryTab } from "@/components/spaces-components/summary-tab";
import { SignInPromptCard } from "@/components/spaces-components/sign-in-prompt-card";
import { SpaceTabsNav } from "@/components/spaces-components/space-tabs-nav";

export default function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("content");
  const [data, setData] = useState<SpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<
    string | undefined
  >(undefined);

  const handleNavigateToChat = (topic: string) => {
    setChatInitialMessage(topic);
    setActiveTab("chat");
  };

  const fetchSpace = useCallback(async () => {
    try {
      const response = await fetch(`/api/spaces/${id}`);
      if (response.ok) {
        const spaceData = await response.json();
        setData(spaceData);
      }
    } catch (error) {
      console.error("Error fetching space:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSpace();
  }, [fetchSpace]);

  const handleDeleteContent = async (contentId: string) => {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: "DELETE",
      });
      if (response.ok) fetchSpace();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Space not found</p>
        <Link href="/spaces">
          <Button className="mt-4">Back to Spaces</Button>
        </Link>
      </div>
    );
  }

  const { space, content, flashcards, quizzes, stats } = data;

  return (
    <div
      className={
        activeTab === "chat"
          ? "flex h-full flex-col flex-1 min-h-0 overflow-hidden"
          : "space-y-6"
      }>
      {!isStudyMode && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/spaces" className="shrink-0">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">
                    {space.name}
                  </h1>
                </div>
                {space.examTarget && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Exam: {space.examTarget}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                className="gap-2"
                onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload Content</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            </div>
          </div>

          {showUploadModal && user && (
            <UploadModal
              spaceId={id}
              userId={user.id}
              onClose={() => setShowUploadModal(false)}
              onSuccess={fetchSpace}
            />
          )}
        </>
      )}

      {!isStudyMode && (
        <SpaceTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          stats={stats}
        />
      )}

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={
          activeTab === "chat"
            ? "w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden"
            : "w-full"
        }>
        <TabsContent value="content" className="space-y-4">
          <ContentTab content={content} onDelete={handleDeleteContent} />
        </TabsContent>

        <TabsContent value="flashcards" className="space-y-4">
          {user && (
            <FlashcardsTab
              flashcards={flashcards}
              spaceId={id}
              userId={user.id}
              hasContent={stats.contentCount > 0}
              onRefresh={fetchSpace}
              onStudyModeChange={setIsStudyMode}
            />
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          {user && (
            <QuizzesTab
              quizzes={quizzes}
              spaceId={id}
              userId={user.id}
              hasContent={stats.contentCount > 0}
              onRefresh={fetchSpace}
            />
          )}
        </TabsContent>

        <TabsContent value="mindmap" className="space-y-4">
          {user ? (
            <MindmapTab
              spaceId={id}
              userId={user.id}
              spaceName={space.name}
              hasContent={stats.contentCount > 0}
              onNavigateToChat={handleNavigateToChat}
            />
          ) : (
            <SignInPromptCard message="Please sign in to generate a mindmap" />
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          {user ? (
            <SummaryTab
              spaceId={id}
              userId={user.id}
              hasContent={stats.contentCount > 0}
              spaceName={space.name}
            />
          ) : (
            <SignInPromptCard message="Please sign in to view the summary" />
          )}
        </TabsContent>

        <TabsContent
          value="chat"
          className={
            activeTab === "chat"
              ? "flex h-full flex-col flex-1 min-h-0 overflow-hidden"
              : ""
          }>
          {user ? (
            <div className="-mx-4 sm:-mx-6 md:-mx-8 flex h-full flex-col flex-1 min-h-0 overflow-hidden">
              <TutorChat
                spaceId={id}
                userId={user.id}
                initialMessage={chatInitialMessage}
              />
            </div>
          ) : (
            <SignInPromptCard message="Please sign in to access the chat feature" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
