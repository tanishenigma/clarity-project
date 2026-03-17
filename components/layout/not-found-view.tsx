import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface NotFoundViewProps {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function NotFoundView({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: NotFoundViewProps) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl p-8 sm:p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <p className="text-sm font-medium text-muted-foreground mb-2">
          404 Error
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for does not exist, may have moved, or is no
          longer available.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href={primaryHref}>
              <Home className="h-4 w-4" />
              {primaryLabel}
            </Link>
          </Button>

          {secondaryHref && secondaryLabel && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}
