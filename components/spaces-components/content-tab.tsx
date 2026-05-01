"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, ExternalLink } from "lucide-react";
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
import { ContentItem } from "./types";

interface ContentTabProps {
  content: ContentItem[];
  onDelete: (id: string) => void;
}

export function ContentTab({ content, onDelete }: ContentTabProps) {
  if (content.length === 0) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center min-h-50">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No content yet</h3>
        <p className="text-muted-foreground mt-2">
          Upload your first file to get started!
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {content.map((item) => (
        <Card
          key={item._id}
          className="p-4 flex flex-col justify-between hover:border-primary transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="overflow-hidden">
                <h4
                  className="font-medium text-foreground truncate"
                  title={item.title}>
                  {item.title}
                </h4>
                <p className="text-xs text-muted-foreground flex gap-2">
                  <span className="uppercase">{item.type}</span>
                  <span>•</span>
                  <span>
                    {item.source?.size
                      ? `${Math.round(item.source.size / 1024)} KB`
                      : "Unknown size"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-auto pt-2 border-t">
            {/* View Document Button */}
            {item.source?.url && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 text-xs gap-1.5"
                onClick={() => window.open(item.source.url, "_blank")}>
                <ExternalLink className="w-3.5 h-3.5" />
                {item.type === "pdf" ? "View PDF" : "View Document"}
              </Button>
            )}

            {/* Delete Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Content</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{item.title}"? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(item._id)}
                    className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      ))}
    </div>
  );
}
