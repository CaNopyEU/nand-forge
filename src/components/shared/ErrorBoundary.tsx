import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-zinc-900 p-8 text-zinc-100">
          <h2 className="text-lg font-semibold text-red-400">Something went wrong</h2>
          <p className="max-w-md text-center text-sm text-zinc-400">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            className="rounded bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
