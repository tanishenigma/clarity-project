import { NotFoundView } from "@/components/layout/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      primaryHref="/"
      primaryLabel="Go to Home"
      secondaryHref="/dashboard"
      secondaryLabel="Go to Dashboard"
    />
  );
}
