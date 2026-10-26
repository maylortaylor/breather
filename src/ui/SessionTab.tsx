import * as stylex from "@stylexjs/stylex";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { getSession } from "../audio/session";
import { saveUserPreset, type Preset } from "../presets";
import { makeId, presetStore } from "../presetStore";
import { store, useStore } from "../store";
import { colors } from "../theme.stylex";
import { STORAGE_LINE } from "./Gate";
import {
  allPresets,
  findPreset,
  messageFor,
  offerSave,
  planSwitch,
  removePreset,
  renamePreset,
  updatePreset,
  type NameFailure,
} from "./sessionLogic";
import { Tip } from "./Tip";

const styles = stylex.create({
  tab: { display: "flex", flexDirection: "column", gap: 16, color: colors.tabInk },
  heading: { margin: 0, fontSize: 14, fontWeight: 700 },
  list: { display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 },
  item: { listStyle: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  preset: {
    flexGrow: 1,
    minHeight: 44,
    paddingInline: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSession,
    backgroundColor: "transparent",
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 15,
    textAlign: "start",
    cursor: "pointer",
  },
  presetOn: { backgroundColor: colors.accentSession, color: colors.bg, fontWeight: 700 },
  small: {
    minHeight: 44,
    paddingInline: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSession,
    backgroundColor: "transparent",
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  actions: { display: "flex", flexWrap: "wrap", gap: 8 },
  form: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, flexBasis: "100%" },
  input: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 44,
    boxSizing: "border-box",
    paddingInline: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.accentSession,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 16,
  },
  note: { margin: 0, fontSize: 15, color: colors.textMuted },
  dim: { display: "flex", alignItems: "center", gap: 12, minHeight: 44, fontSize: 16 },
  check: { width: 22, height: 22, margin: 0, accentColor: colors.accentSession },
  footer: { display: "flex", flexDirection: "column", gap: 8 },
  link: {
    alignSelf: "flex-start",
    minHeight: 44,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: colors.tabInk,
    fontFamily: "inherit",
    fontSize: 15,
    textDecoration: "underline",
    cursor: "pointer",
  },
});

type Pending =
  | { kind: "save" }
  | { kind: "rename"; id: string }
  | { kind: "delete"; id: string }
  | null;

/** The store holds the mix, the mixer makes the running audio match it. Master is not touched. */
function choose(preset: Preset) {
  const plan = planSwitch(preset);
  store.set({ presetId: plan.presetId, mix: plan.mix, dim: plan.dim });
  getSession()?.mixer.apply(plan.mix, { fadeSec: plan.fadeSec });
}

const setDim = (dim: boolean) => store.set({ dim });
const reopenWelcome = () => store.set({ reviewWelcome: true });

function NameForm({
  initial,
  label,
  action,
  error,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  action: string;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    onSubmit(name);
  };
  return (
    <form {...stylex.props(styles.form)} onSubmit={submit}>
      <input
        type="text"
        aria-label={label}
        value={name}
        autoFocus
        autoComplete="off"
        onChange={(ev) => setName(ev.target.value)}
        {...stylex.props(styles.input)}
      />
      <button type="submit" {...stylex.props(styles.small)}>
        {action}
      </button>
      <button type="button" {...stylex.props(styles.small)} onClick={onCancel}>
        Cancel
      </button>
      {error && (
        <p role="status" {...stylex.props(styles.note)}>
          {error}
        </p>
      )}
    </form>
  );
}

/** The Session tab: presets, dim mode, the storage line and "How it works". */
export function SessionTab() {
  const user = useSyncExternalStore(presetStore.subscribe, () => presetStore.get().presets);
  const mix = useStore((s) => s.mix);
  const dim = useStore((s) => s.dim);
  const presetId = useStore((s) => s.presetId);
  const [pending, setPending] = useState<Pending>(null);
  const [problem, setProblem] = useState<NameFailure | "missing" | null>(null);

  const active = findPreset(user, presetId);
  const offer = offerSave(active, mix, dim);
  const done = () => {
    setPending(null);
    setProblem(null);
  };
  const start = (next: Pending) => {
    setProblem(null);
    setPending(next);
  };

  const saveNew = (name: string) => {
    const r = saveUserPreset(user, name, mix, dim, makeId);
    if (!r.ok) return setProblem(r.reason);
    presetStore.set({ presets: r.presets });
    store.set({ presetId: r.preset.id });
    done();
  };
  const rename = (id: string, name: string) => {
    const r = renamePreset(user, id, name);
    if (!r.ok) return setProblem(r.reason);
    presetStore.set({ presets: r.presets });
    done();
  };
  const remove = (id: string) => {
    presetStore.set({ presets: removePreset(user, id) });
    // The mix keeps playing; it just no longer belongs to a saved preset.
    if (store.get().presetId === id) store.set({ presetId: null });
    done();
  };
  const update = (id: string) => {
    presetStore.set({ presets: updatePreset(user, id, mix, dim) });
  };

  const failure = problem ? messageFor(problem) : null;
  return (
    <div {...stylex.props(styles.tab)}>
      <h2 {...stylex.props(styles.heading)}>Presets</h2>
      <ul aria-label="Presets" {...stylex.props(styles.list)}>
        {allPresets(user).map((p) => {
          const on = p.id === presetId;
          return (
            <li key={p.id} {...stylex.props(styles.item)}>
              <button
                type="button"
                aria-pressed={on}
                {...stylex.props(styles.preset, on && styles.presetOn)}
                onClick={() => choose(p)}
              >
                {p.name}
                {on && offer ? " (changed)" : ""}
              </button>
              {!p.builtIn && (
                <>
                  <button
                    type="button"
                    aria-label={`Rename ${p.name}`}
                    {...stylex.props(styles.small)}
                    onClick={() => start({ kind: "rename", id: p.id })}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    {...stylex.props(styles.small)}
                    onClick={() => start({ kind: "delete", id: p.id })}
                  >
                    Delete
                  </button>
                </>
              )}
              {pending?.kind === "rename" && pending.id === p.id && (
                <NameForm
                  initial={p.name}
                  label={`New name for ${p.name}`}
                  action="Rename"
                  error={failure}
                  onSubmit={(name) => rename(p.id, name)}
                  onCancel={done}
                />
              )}
              {pending?.kind === "delete" && pending.id === p.id && (
                <div {...stylex.props(styles.form)}>
                  <p {...stylex.props(styles.note)}>Delete {p.name}?</p>
                  <button
                    type="button"
                    {...stylex.props(styles.small)}
                    onClick={() => remove(p.id)}
                  >
                    Yes, delete
                  </button>
                  <button type="button" {...stylex.props(styles.small)} onClick={done}>
                    Keep it
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {offer && pending?.kind !== "save" && (
        <div {...stylex.props(styles.actions)}>
          <Tip text="Keep this mix as a preset of your own. Sleep, Focus and Reset never change.">
            <button
              type="button"
              {...stylex.props(styles.small)}
              onClick={() => start({ kind: "save" })}
            >
              Save as new
            </button>
          </Tip>
          {offer === "update-or-save" && active && (
            <button type="button" {...stylex.props(styles.small)} onClick={() => update(active.id)}>
              Update {active.name}
            </button>
          )}
        </div>
      )}
      {pending?.kind === "save" && (
        <NameForm
          initial=""
          label="Preset name"
          action="Save"
          error={failure}
          onSubmit={saveNew}
          onCancel={done}
        />
      )}
      <Tip text="A warmer, darker look for night. The aurora dims too.">
        <label {...stylex.props(styles.dim)}>
          <input
            type="checkbox"
            role="switch"
            checked={dim}
            {...stylex.props(styles.check)}
            onChange={(ev) => setDim(ev.target.checked)}
          />
          Dim mode
        </label>
      </Tip>
      <div {...stylex.props(styles.footer)}>
        <p {...stylex.props(styles.note)}>{STORAGE_LINE}</p>
        <button type="button" {...stylex.props(styles.link)} onClick={reopenWelcome}>
          How it works
        </button>
      </div>
    </div>
  );
}
