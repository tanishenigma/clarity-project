import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SignInPromptCardProps {
  message: string;
}

export function SignInPromptCard({ message }: SignInPromptCardProps) {
  return (
    <Card className="p-8 text-center">
      <p className="text-muted-foreground mb-4">{message}</p>
      <Link href="/auth">
        <Button>Sign In</Button>
      </Link>
    </Card>
  );
}
