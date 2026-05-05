import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { Conversation } from "./types";

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  // formatDate: (dateString: string) => string;
}

export function ConversationCard({
  conversation,
  isActive,
  onSelect,
  onDelete,
  // formatDate,
}: ConversationCardProps) {
  return (
    <Card
      className={cn(
        "group relative cursor-pointer transition-all duration-200  p-1 shadow-none border-none bg-transparent",
        isActive ? "bg-primary/10 border-primary/50 " : "  hover:bg-muted/50",
      )}
      onClick={() => onSelect(conversation._id)}>
      <div className="px-3 ">
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              "text-sm font-medium line-clamp-1 flex-1",
              isActive ? "text-primary" : "text-foreground",
            )}>
            {conversation.title}
          </h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className=" w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                onClick={(e) => e.stopPropagation()}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(conversation._id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(conversation.updatedAt)}</span>
        </div> */}
      </div>
    </Card>
  );
}
