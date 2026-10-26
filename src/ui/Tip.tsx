import * as stylex from "@stylexjs/stylex";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { colors } from "../theme.stylex";
import {
  createDelayedAction,
  LONG_PRESS_MS,
  TOOLTIP_DELAY_MS,
  type DelayedAction,
} from "./tooltipTimer";

const styles = stylex.create({
  tipWrap: { position: "relative", display: "inline-flex", alignItems: "center", gap: 6 },
  tipFill: { flexGrow: 1, minWidth: 0 },
  tipVolume: { flexGrow: 2, flexBasis: 220, minWidth: 150, display: "flex" },
  tip: {
    position: "fixed",
    zIndex: 20,
    width: "max-content",
    maxWidth: "min(260px, calc(100vw - 16px))",
    padding: "8px 10px",
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.textMuted,
    color: colors.text,
    fontSize: 13,
    lineHeight: 1.35,
    textAlign: "left",
    pointerEvents: "none",
  },
});

/**
 * Wraps a control (or a small group of them) with a one-line tooltip. It shows after the pointer or
 * keyboard focus rests on the control for 2.5 s, or after a 600 ms touch long press; it hides on
 * leave, blur, Escape, scroll or a tap elsewhere. The text is linked to every control inside with
 * aria-describedby at all times, so screen readers get it without the delay.
 */
export function Tip({
  text,
  grow,
  children,
}: {
  text: string;
  grow?: "fill" | "volume";
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const hideSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set after a touch long press so the lift of the finger does not also click the control.
  const swallowClick = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const timers = useRef<{ hover: DelayedAction; press: DelayedAction } | null>(null);

  useEffect(() => {
    const hover = createDelayedAction(TOOLTIP_DELAY_MS, () => setOpen(true));
    const press = createDelayedAction(LONG_PRESS_MS, () => {
      swallowClick.current = true;
      setOpen(true);
    });
    timers.current = { hover, press };
    return () => {
      hover.cancel();
      press.cancel();
      timers.current = null;
    };
  }, []);

  const hide = useCallback(() => {
    timers.current?.hover.cancel();
    timers.current?.press.cancel();
    if (hideSoon.current) clearTimeout(hideSoon.current);
    hideSoon.current = null;
    setOpen(false);
  }, []);

  // Link the text to every focusable control inside, whether or not the bubble is showing.
  useEffect(() => {
    for (const el of wrap.current?.querySelectorAll("button, input, select, [role=group]") ?? []) {
      el.setAttribute("aria-describedby", id);
    }
  });

  // While open: close on Escape, scroll, or a pointer press anywhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  // Keep the bubble inside the viewport, below the control (so it never covers a thumb), or above
  // it when there is no room below.
  useLayoutEffect(() => {
    const t = tip.current;
    const w = wrap.current;
    if (!open || !t || !w) return;
    const r = w.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), Math.max(8, innerWidth - b.width - 8));
    const below = r.bottom + 8;
    const top = below + b.height > innerHeight - 8 ? Math.max(8, r.top - b.height - 8) : below;
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
    t.style.visibility = "visible";
  }, [open]);

  return (
    <span
      ref={wrap}
      {...stylex.props(
        styles.tipWrap,
        grow === "fill" && styles.tipFill,
        grow === "volume" && styles.tipVolume
      )}
      onPointerEnter={(ev) => {
        if (ev.pointerType === "mouse") timers.current?.hover.start();
      }}
      onPointerMove={(ev) => {
        if (ev.pointerType === "mouse" && !open) timers.current?.hover.start();
        const t0 = touchStart.current;
        if (t0 && Math.hypot(ev.clientX - t0.x, ev.clientY - t0.y) > 10) {
          timers.current?.press.cancel();
        }
      }}
      onPointerLeave={(ev) => {
        if (ev.pointerType === "mouse") hide();
      }}
      onPointerDownCapture={(ev) => {
        swallowClick.current = false;
        if (ev.pointerType === "mouse") {
          hide();
        } else {
          touchStart.current = { x: ev.clientX, y: ev.clientY };
          timers.current?.press.start();
        }
      }}
      onPointerUp={() => {
        timers.current?.press.cancel();
        touchStart.current = null;
        if (open && swallowClick.current) {
          hideSoon.current = setTimeout(hide, 1500);
        }
      }}
      onPointerCancel={() => {
        timers.current?.press.cancel();
        touchStart.current = null;
      }}
      onClickCapture={(ev) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
      onContextMenu={(ev) => {
        if (swallowClick.current || timers.current?.press.pending) ev.preventDefault();
      }}
      onFocus={(ev) => {
        if ((ev.target as HTMLElement).matches(":focus-visible")) timers.current?.hover.start();
      }}
      onBlur={hide}
    >
      {children}
      <span
        ref={tip}
        id={id}
        role="tooltip"
        hidden={!open}
        style={{ visibility: "hidden" }}
        {...stylex.props(styles.tip)}
      >
        {text}
      </span>
    </span>
  );
}
