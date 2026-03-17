export interface UploadedFile {
  name: string;
  type: string;
  url?: string;
}

export interface GraphExpression {
  id: string;
  latex: string;
  color?: string;
  hidden?: boolean;
}

export interface GraphViewport {
  xmin: number;
  xmax: number;
  ymin?: number;
  ymax?: number;
}

export interface GraphAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface GraphUpdate {
  expressions: GraphExpression[];
  viewport?: GraphViewport;
  annotations?: GraphAnnotation[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  toolsUsed?: string[];
  graphUpdate?: GraphUpdate;
  feedbackLog?: string[];
}

export interface Conversation {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface ChatHeaderProps {
  isTyping: boolean;
  hasMessages: boolean;
  onNewChat: () => void;
  onToggleSidebar?: () => void;
}
