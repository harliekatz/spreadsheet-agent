"use client";

import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Keeps a render failure from blanking the page. Saved sheets live in
 * localStorage, so reloading recovers the user's work.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled UI error", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-error" role="alert">
        <TriangleAlert size={28} aria-hidden="true" />
        <h1>Something broke in the interface</h1>
        <p>
          Your saved sheets are stored in this browser and were not affected. Reloading
          should restore the workspace.
        </p>
        <pre>
          <code>{this.state.error.message}</code>
        </pre>
        <div className="fatal-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload the app
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try to continue
          </button>
        </div>
      </div>
    );
  }
}
