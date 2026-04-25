import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any render-time JS exception beneath it and shows a friendly
 * recovery UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Something went wrong</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
