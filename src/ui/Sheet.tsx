import * as stylex from "@stylexjs/stylex";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { store, useStore, type TabName } from "../store";
import { colors } from "../theme.stylex";
import { BreathTab } from "./BreathTab";
import { SessionTab } from "./SessionTab";
import { SoundsTab } from "./SoundsTab";
import { Tip } from "./Tip";
import {
  classifyGesture,
  createAutoHide,
  sheetStyle,
  WIDE_QUERY_PX,
  type AutoHide,
} from "./sheetLogic";

const TABS: { name: TabName; label: string }[] = [
  { name: "breath", label: "Breath" },
  { name: "sounds", label: "Sounds" },
  { name: "session", label: "Session" },
];

const BODIES: Record<TabName, ReactNode> = {
  breath: <BreathTab />,
  sounds: <SoundsTab />,
  session: <SessionTab />,
};

const styles = stylex.create({
  root: {
    position: "fixed",
    zIndex: 10,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    color: colors.tabInk,
    fontFamily: "inherit",
    overflow: "hidden",
  },
  // Phones: a bottom sheet about 60% tall.
  sheet: {
    insetInline: 0,
    bottom: 0,
    height: "60dvh",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  // 900 px and wider: a right-side panel.
  panel: {
    top: 0,
    bottom: 0,
    right: 0,
    width: 380,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  // Fixed at bottom centre; above the sheet on phones so it never sits on its content.
  settingsDock: {
    position: "fixed",
    zIndex: 11,
    insetInline: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },
  dockClosed: { bottom: "max(16px, env(safe-area-inset-bottom))" },
  dockOpenSheet: { bottom: "calc(60dvh + 12px)" },
  settings: {
    pointerEvents: "auto",
    minHeight: 44,
    paddingInline: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentBreath,
    backgroundColor: colors.tabBreath,
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 16,
    cursor: "pointer",
  },
  breath: { backgroundColor: colors.tabBreath },
  sounds: { backgroundColor: colors.tabSounds },
  session: { backgroundColor: colors.tabSession },
  handle: {
    flexShrink: 0,
    display: "flex",
    justifyContent: "center",
    paddingBlock: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  grip: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.thumb },
  tabs: { flexShrink: 0, display: "flex", gap: 8, paddingInline: 16 },
  tab: {
    flexGrow: 1,
    paddingBlock: 10,
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    borderRadius: 10,
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 16,
    cursor: "pointer",
  },
  tabBreath: { backgroundColor: colors.tabBreath },
  tabSounds: { backgroundColor: colors.tabSounds },
  tabSession: { backgroundColor: colors.tabSession },
  tabOn: { fontWeight: 700 },
  accentBreath: { borderBottomColor: colors.accentBreath },
  accentSounds: { borderBottomColor: colors.accentSounds },
  accentSession: { borderBottomColor: colors.accentSession },
  body: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    touchAction: "pan-y",
    padding: 16,
    paddingBottom: "max(16px, env(safe-area-inset-bottom))",
  },
});

const FIELD = { breath: styles.breath, sounds: styles.sounds, session: styles.session };
const TAB_FIELD = {
  breath: styles.tabBreath,
  sounds: styles.tabSounds,
  session: styles.tabSession,
};
const ACCENT = {
  breath: styles.accentBreath,
  sounds: styles.accentSounds,
  session: styles.accentSession,
};

const SHEET_ID = "sheet-controls";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const WIDE_QUERY = `(min-width: ${WIDE_QUERY_PX}px)`;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener?.("change", notify);
      return () => mq?.removeEventListener?.("change", notify);
    },
    () => Boolean(window.matchMedia?.(query).matches)
  );
}

const setOpen = (open: boolean) => store.set((s) => ({ sheet: { ...s.sheet, open } }));
const setTab = (tab: TabName) => store.set((s) => ({ sheet: { ...s.sheet, tab } }));

// A press inside these never counts as a tap away from the ring.
const INTERACTIVE = "button, a, input, select, textarea, [data-sheet]";

/** Opens the sheet on a tap away from the ring, a swipe up, or the Up arrow key. */
function useOpenGestures(enabled: boolean, onKeyboardOpen: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let down: { x: number; y: number; t: number; inside: boolean } | null = null;
    const onDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      down = {
        x: ev.clientX,
        y: ev.clientY,
        t: ev.timeStamp,
        inside: Boolean(target?.closest?.(INTERACTIVE)),
      };
    };
    const onUp = (ev: PointerEvent) => {
      if (!down) return;
      const g = classifyGesture({
        dx: ev.clientX - down.x,
        dy: ev.clientY - down.y,
        ms: ev.timeStamp - down.t,
      });
      // A tap on a control is the control's; a swipe up works anywhere.
      if (g === "swipe-up" || (g === "tap" && !down.inside)) setOpen(true);
      down = null;
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "ArrowUp" || ev.defaultPrevented) return;
      onKeyboardOpen();
      setOpen(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, onKeyboardOpen]);
}

/**
 * Every control in one sheet: a bottom sheet on phones, a right panel from 900 px. It dissolves
 * after 5 s of no input and returns on any tap or pointer move.
 */
export function Sheet() {
  const resting = useStore((s) => s.screen === "resting");
  const { open, tab } = useStore((s) => s.sheet);
  const wide = useMedia(WIDE_QUERY);
  const reduced = useMedia(REDUCED_QUERY);
  const [dissolved, setDissolved] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<AutoHide | null>(null);
  const keyboard = useRef(false);
  const focusTab = useRef(false);
  const settingsRef = useRef<HTMLButtonElement>(null);

  useOpenGestures(resting && !open, () => {
    focusTab.current = true;
  });

  // Closing returns focus to the control that opened the sheet, or to Settings when focus was
  // nowhere in particular (a tap, a click in Safari). Skipped if focus already moved elsewhere.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    const from = active instanceof HTMLElement && active !== document.body ? active : null;
    const settings = settingsRef.current;
    return () => {
      const to = from?.isConnected ? from : settings;
      const now = document.activeElement;
      if (to?.isConnected && (!now || now === document.body)) to.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const hide = createAutoHide({
      after: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      },
      onChange: setDissolved,
    });
    hideRef.current = hide;
    hide.start();
    // Keyboard focus inside holds the sheet open; mouse or touch focus does not.
    const sync = () =>
      hide.setHeld(keyboard.current && Boolean(rootRef.current?.contains(document.activeElement)));
    const onKey = (ev: KeyboardEvent) => {
      keyboard.current = true;
      hide.activity();
      sync();
      if (ev.key === "Escape" && !document.querySelector("[role=tooltip]:not([hidden])")) {
        setOpen(false);
      }
    };
    const onPointer = () => {
      keyboard.current = false;
      hide.activity();
      sync();
    };
    const onActivity = () => hide.activity();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("pointermove", onActivity);
    document.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("wheel", onActivity, { passive: true });
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    if (focusTab.current) {
      focusTab.current = false;
      rootRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("pointermove", onActivity);
      document.removeEventListener("touchstart", onActivity);
      document.removeEventListener("wheel", onActivity);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      hide.stop();
      hideRef.current = null;
    };
  }, [open]);

  if (!resting) return null;

  const onTabKey = (ev: ReactKeyboardEvent<HTMLElement>) => {
    const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    ev.preventDefault();
    const i = TABS.findIndex((t) => t.name === tab);
    const next = TABS[(i + step + TABS.length) % TABS.length]!;
    setTab(next.name);
    rootRef.current?.querySelector<HTMLElement>(`#tab-${next.name}`)?.focus();
  };

  return (
    <>
      <div
        {...stylex.props(
          styles.settingsDock,
          open && !wide && !dissolved ? styles.dockOpenSheet : styles.dockClosed
        )}
      >
        <Tip text="Sounds, tempo and presets">
          <button
            ref={settingsRef}
            type="button"
            aria-expanded={open}
            aria-controls={open ? SHEET_ID : undefined}
            {...stylex.props(styles.settings)}
            onClick={() => setOpen(!open)}
          >
            Settings
          </button>
        </Tip>
      </div>
      {open && (
        <section
          id={SHEET_ID}
          ref={rootRef}
          aria-label="Sound controls"
          data-sheet
          data-layout={wide ? "panel" : "sheet"}
          data-dissolved={dissolved}
          className="sheet-mask"
          style={sheetStyle(dissolved, reduced)}
          {...stylex.props(styles.root, wide ? styles.panel : styles.sheet, FIELD[tab])}
        >
          <button
            type="button"
            aria-label="Close controls"
            {...stylex.props(styles.handle)}
            onClick={() => setOpen(false)}
          >
            <span {...stylex.props(styles.grip)} />
          </button>
          <div role="tablist" aria-label="Controls" {...stylex.props(styles.tabs)}>
            {TABS.map((t) => (
              <button
                key={t.name}
                id={`tab-${t.name}`}
                type="button"
                role="tab"
                aria-selected={t.name === tab}
                aria-controls={`panel-${t.name}`}
                tabIndex={t.name === tab ? 0 : -1}
                {...stylex.props(
                  styles.tab,
                  TAB_FIELD[t.name],
                  t.name === tab && styles.tabOn,
                  t.name === tab && ACCENT[t.name]
                )}
                onClick={() => setTab(t.name)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            {...stylex.props(styles.body)}
          >
            {BODIES[tab]}
          </div>
        </section>
      )}
    </>
  );
}
