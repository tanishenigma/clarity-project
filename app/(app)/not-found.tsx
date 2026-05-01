import { NotFoundView } from "@/components/layout/not-found-view";

export default function AppNotFound() {
  return (
    <NotFoundView
      primaryHref="/dashboard"
      primaryLabel="Go to Dashboard"
      secondaryHref="/spaces"
      secondaryLabel="Go to Spaces"
    />
  );
}
