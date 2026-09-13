import Workspace from "@/components/Workspace";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <Workspace />
    </ErrorBoundary>
  );
}
