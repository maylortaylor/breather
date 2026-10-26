import { Component, type ErrorInfo, type ReactNode } from "react";
import { Background } from "./background/Background";
import { Breath } from "./breath/Ring";
import { Gate, SoundNote } from "./ui/Gate";
import { useStore } from "./store";

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
      <Background />
      <main className="shell">{children}</main>
    </ErrorBoundary>
  );
}

/** The Begin gate, then the resting screen: the ring and its phase word (the sheet lands in 20). */
export function Screens() {
  const resting = useStore((s) => s.screen === "resting");
  return resting ? (
    <Breath>
      <SoundNote />
    </Breath>
  ) : (
    <Gate />
  );
}
