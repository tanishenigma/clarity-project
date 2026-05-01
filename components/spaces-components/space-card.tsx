"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Space } from "@/lib/types/space";
import {
  Pencil,
  Check,
  X,
  GraduationCap,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SpaceUpdate {
  name: string;
  subject: string;
  examTarget: string;
}

interface SpaceCardProps {
  space: Space;
  onUpdate?: (id: string, updates: SpaceUpdate) => void;
  onDelete?: (id: string) => void;
}

const SpaceCard = ({ space, onUpdate, onDelete }: SpaceCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(space.name);
  const [editSubject, setEditSubject] = useState(space.subject || "");
  const [editExamTarget, setEditExamTarget] = useState(space.examTarget || "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const confirmUpdate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editName.trim()) {
      onUpdate?.(space._id, {
        name: editName.trim(),
        subject: editSubject.trim(),
        examTarget: editExamTarget.trim(),
      });
    }
    setIsEditing(false);
  };

  const cancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleDeleteSpace = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/spaces/${space._id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        window.dispatchEvent(
          new CustomEvent("space-deleted", { detail: { _id: space._id } }),
        );
        onDelete?.(space._id);
      }
    } catch (error) {
      console.error("Error deleting space:", error);
    }
  };

  return (
    <div className="relative h-full group">
      {/* Action Buttons — outside Link so they never trigger navigation */}
      {onUpdate && !isEditing && (
        <>
          {/* Desktop: hover-only edit/delete buttons */}
          <div className="absolute right-3 top-3 z-10 hidden md:flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              onClick={startEditing}
              className="rounded-lg border border-border/60 bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:text-primary"
              title="Edit space">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
              className="rounded-lg border border-border/60 bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-all hover:border-destructive/40 hover:text-destructive"
              title="Delete space">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mobile: 3-dot dropdown */}
          <div
            className="absolute right-3 top-3 z-10 md:hidden"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-lg border border-border/60 bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm"
                  title="More options">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-80">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startEditing(e as unknown as React.MouseEvent);
                  }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Shared AlertDialog for delete confirmation */}
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Space</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure? This will permanently delete &quot;
                  {space.name}&quot; and all its contents.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSpace}
                  className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <Link href={`/spaces/${space._id}`} className="block h-full">
        <div
          className={cn(
            "group relative flex h-full flex-col rounded-2xl border border-border/60 bg-card",
            "transition-all duration-300 ease-out",
            "group-hover:-translate-y-1.5 group-hover:border-border grouphover:shadow-lg",
          )}>
          <div className="relative flex flex-1 flex-col p-5">
            {isEditing ? (
              <div
                className="flex flex-col gap-3"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Name
                  </label>
                  <input
                    ref={nameInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmUpdate(e)}
                    className="w-full rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Subject
                    </label>
                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
                      placeholder="Subject"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Target
                    </label>
                    <input
                      value={editExamTarget}
                      onChange={(e) => setEditExamTarget(e.target.value)}
                      className="w-full rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
                      placeholder="Exam"
                    />
                  </div>
                </div>

                <div className="mt-1 flex gap-2">
                  <button
                    onClick={confirmUpdate}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition">
                    <Check className="h-3 w-3" /> Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/60 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition">
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 pr-10">
                  {space.subject && (
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      {space.subject}
                    </span>
                  )}
                  <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                    {space.name}
                  </h3>
                  {space.description && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                      {space.description}
                    </p>
                  )}
                </div>

                {space.examTarget && (
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                      <GraduationCap className="h-3 w-3" />
                      {space.examTarget}
                    </span>
                  </div>
                )}

                <div className="mt-auto">
                  <div className="flex items-center divide-x divide-border/50 rounded-xl border border-border/50 bg-muted/40">
                    {[
                      { value: space.stats?.contentCount ?? 0, label: "Items" },
                      {
                        value: space.stats?.flashcardCount ?? 0,
                        label: "Cards",
                      },
                      { value: space.stats?.quizCount ?? 0, label: "Quizzes" },
                    ].map(({ value, label }) => (
                      <div
                        key={label}
                        className="flex flex-1 flex-col items-center py-2">
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          {value}
                        </span>
                        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default SpaceCard;
