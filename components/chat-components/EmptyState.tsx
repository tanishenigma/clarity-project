import {
  FileText,
  MessageSquare,
  MessageCircle,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState() {
  const features = [
    { icon: FileText, text: "Analyze documents and PDFs" },
    { icon: MessageSquare, text: "Answer your questions" },
    { icon: ImageIcon, text: "Process images and diagrams" },
    { icon: Upload, text: "Work with multiple files" },
  ];

  return (
    <div className="flex h-full items-center justify-center p-4 min-w-0">
      <Card className="w-full max-w-sm md:max-w-md p-5 text-center bg-card/50 border-border/50 shadow-lg min-w-0">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shrink-0">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-bold mb-1.5 text-foreground">
          Start a conversation
        </h2>
        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
          I can help you analyze documents, write code, or explain complex
          topics.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left min-w-0">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border/50 min-w-0">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm text-foreground truncate">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
