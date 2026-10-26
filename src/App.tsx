import { Component, type ErrorInfo, type ReactNode } from "react";

type BoundaryProps = { children: ReactNode; onReload: () => void };

// A render error shows a calm screen; the error goes to the console only (ticket 04).
class ErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // oxlint-disable-next-line no-console
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="shell shell-fallback">
        <p>Something went wrong. Reloading usually fixes it.</p>
        <button type="button" onClick={this.props.onReload}>
          Reload
        </button>
      </main>
    );
  }
}

type AppProps = { children?: ReactNode; onReload?: () => void };

export function App({ children, onReload = () => window.location.reload() }: AppProps) {
  return (
    <ErrorBoundary onReload={onReload}>
      <main className="shell">{children}</main>
    </ErrorBoundary>
  );
}
