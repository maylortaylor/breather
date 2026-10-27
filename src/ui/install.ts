// One-tap install on phones. Chrome fires `beforeinstallprompt` when the app can be installed;
// the event is held until the listener taps the button, which calls its `prompt()`.
import { useSyncExternalStore } from "react";

export interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: string }>;
}

export interface InstallEnv {
  /** A phone-sized touch device. */
  isPhone: () => boolean;
  /** Already running as the installed app. */
  isInstalled: () => boolean;
}

export const browserInstallEnv = (): InstallEnv => ({
  isPhone: () => {
    const mobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
      ?.mobile;
    return mobile ?? /Android|iPhone|iPad/i.test(navigator.userAgent);
  },
  isInstalled: () =>
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
});

export interface Installer {
  /** True when a phone can install the app right now and has not yet. */
  canInstall(): boolean;
  /** Shows Chrome's install dialog. Resolves true if the listener accepted. */
  install(): Promise<boolean>;
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

export function createInstaller(
  target: Pick<Window, "addEventListener" | "removeEventListener">,
  env: InstallEnv
): Installer {
  let held: InstallEvent | null = null;
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((fn) => fn());
  const onPrompt = (ev: Event) => {
    // Hold it back so Chrome's own mini-bar does not appear; the button is the one way in.
    ev.preventDefault();
    held = ev as InstallEvent;
    notify();
  };
  const onInstalled = () => {
    held = null;
    notify();
  };
  target.addEventListener("beforeinstallprompt", onPrompt);
  target.addEventListener("appinstalled", onInstalled);
  return {
    canInstall: () => held !== null && env.isPhone() && !env.isInstalled(),
    async install() {
      const ev = held;
      if (!ev) return false;
      // A prompt can be shown once per event; Chrome fires a new one if the listener dismisses.
      held = null;
      notify();
      try {
        await ev.prompt();
        return (await ev.userChoice)?.outcome === "accepted";
      } catch {
        return false;
      }
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    dispose() {
      target.removeEventListener("beforeinstallprompt", onPrompt);
      target.removeEventListener("appinstalled", onInstalled);
    },
  };
}

// The event can fire before React mounts, so the app-wide installer starts at module load.
let shared: Installer | null = null;
export const getInstaller = (): Installer | null => {
  if (typeof window === "undefined") return null;
  return (shared ??= createInstaller(window, browserInstallEnv()));
};

export function useCanInstall(): boolean {
  const inst = getInstaller();
  return useSyncExternalStore(
    (fn) => inst?.subscribe(fn) ?? (() => {}),
    () => inst?.canInstall() ?? false
  );
}
