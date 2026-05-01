"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2, Image, File, CheckCircle } from "lucide-react";

interface UploadModalProps {
  spaceId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadModal({
  spaceId,
  userId,
  onClose,
  onSuccess,
}: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.type === "application/pdf" ||
        file.type.startsWith("image/") ||
        file.type.includes("wordprocessingml") ||
        file.type === "text/plain" ||
        file.type.startsWith("audio/") ||
        file.type.startsWith("video/");
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      setUploadFiles([...uploadFiles, ...validFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress("Uploading...");

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        setUploadProgress(
          `Uploading ${i + 1}/${uploadFiles.length}: ${file.name}`,
        );

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", uploadTitle || file.name);
        formData.append("spaceId", spaceId);
        formData.append("userId", userId);

        const response = await fetch("/api/content/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const msg = errBody?.error || `Failed to upload ${file.name}`;
          console.error(`[UploadModal] Server error for "${file.name}":`, msg);
          throw new Error(msg);
        }
        console.log(
          `[UploadModal] ✓ Uploaded "${file.name}" (${i + 1}/${uploadFiles.length})`,
        );
      }

      setUploadProgress("Upload complete!");
      onSuccess();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("[UploadModal] Upload error:", error);
      setUploadProgress(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-100 backdrop-blur-xs">
      <Card className="w-full max-w-lg p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Upload Content</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={uploading}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Title (optional)
            </label>
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Content title..."
              disabled={uploading}
              className="mt-1"
            />
          </div>

          <div>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx,.mp3,.mp4,.wav"
              onChange={handleFileSelect}
              className="hidden"
              ref={fileInputRef}
              disabled={uploading}
            />
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to select files or drag and drop
              </p>
            </div>
          </div>

          {uploadFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Selected files ({uploadFiles.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {uploadFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type.startsWith("image/") ? (
                        <Image className="w-4 h-4" />
                      ) : (
                        <File className="w-4 h-4" />
                      )}
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() =>
                        setUploadFiles((files) =>
                          files.filter((_, i) => i !== idx),
                        )
                      }
                      disabled={uploading}
                      className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <CheckCircle className="w-4 h-4 text-success" />
              )}
              <span>{uploadProgress}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading}
              className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || uploadFiles.length === 0}
              className="flex-1">
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
