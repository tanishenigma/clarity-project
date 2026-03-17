"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateSpaceModal = ({
  isOpen,
  onClose,
  onSuccess,
}: CreateSpaceModalProps) => {
  const { user } = useAuth();

  // Local state for the form
  const [creating, setCreating] = useState(false);
  const [newSpace, setNewSpace] = useState({
    name: "",
    subject: "",
    examTarget: "",
  });

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...newSpace,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.space) {
          window.dispatchEvent(
            new CustomEvent("space-created", { detail: data.space }),
          );
        }
        setNewSpace({ name: "", subject: "", examTarget: "" });
        onClose();
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating space:", error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Create New Space
        </h2>
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="e.g., Biology - Cell Structure"
              value={newSpace.name}
              onChange={(e) =>
                setNewSpace({ ...newSpace, name: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              placeholder="e.g., Biology"
              value={newSpace.subject}
              onChange={(e) =>
                setNewSpace({ ...newSpace, subject: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Exam Target</label>
            <Input
              placeholder="e.g., NEET 2029"
              value={newSpace.examTarget}
              onChange={(e) =>
                setNewSpace({ ...newSpace, examTarget: e.target.value })
              }
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !newSpace.name}>
              {creating ? "Creating..." : "Create Space"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateSpaceModal;
