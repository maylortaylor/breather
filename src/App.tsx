import * as stylex from "@stylexjs/stylex";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Background } from "./background/Background";
import { Breath } from "./breath/Ring";
import { Gate, SoundNote } from "./ui/Gate";
import { Sheet } from "./ui/Sheet";
import { useStore } from "./store";
import { dimTheme } from "./theme.stylex";

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

/** The dim theme reaches every control, not just the aurora, the moment dim mode is on. */
function Shell({ children }: { children?: ReactNode }) {
  const dim = useStore((s) => s.dim);
  const themed = stylex.props(dim && dimTheme);
  return (
    <main className={["shell", themed.className].filter(Boolean).join(" ")} style={themed.style}>
      {children}
    </main>
  );
}

type AppProps = { children?: ReactNode; onReload?: () => void };

export function App({ children, onReload = () => window.location.reload() }: AppProps) {
  return (
    <ErrorBoundary onReload={onReload}>
      <Background />
      <Shell>{children}</Shell>
    </ErrorBoundary>
  );
}

/** The Begin gate, then the resting screen: the ring and its phase word and the controls sheet. */
export function Screens() {
  const resting = useStore((s) => s.screen === "resting" && !s.reviewWelcome);
  return resting ? (
    <>
      <Breath>
        <SoundNote />
      </Breath>
      <Sheet />
    </>
  ) : (
    <Gate />
  );
}
