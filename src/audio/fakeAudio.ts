// Test double for the Web Audio graph: every node records its connections, every AudioParam is a
// stub, and the engine keeps real wet-list bookkeeping so leaks show up as a non-empty list.
import type { Engine } from "./engine";

export interface FakeNode {
  kind: string;
  connections: Set<FakeNode>;
  onended: (() => void) | null;
  connect(to: FakeNode): FakeNode;
  disconnect(to?: FakeNode): void;
  start(): void;
  stop(): void;
  [param: string]: unknown;
}

const makeParam = () => ({
  value: 0,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
  setTargetAtTime() {},
  cancelScheduledValues() {},
});

export function makeNode(kind: string): FakeNode {
  const params = new Map<string, ReturnType<typeof makeParam>>();
  const node: FakeNode = {
    kind,
    connections: new Set(),
    onended: null,
    connect(to) {
      node.connections.add(to);
      return to;
    },
    disconnect(to) {
      if (to) {
        if (!node.connections.delete(to)) throw new Error("InvalidAccessError");
      } else node.connections.clear();
    },
    start() {},
    stop() {},
  };
  // Any other property (gain, frequency, Q, pan, ...) is an AudioParam stub, created on demand.
  return new Proxy(node, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (typeof prop !== "string" || prop === "then") return undefined;
      let p = params.get(prop);
      if (!p) params.set(prop, (p = makeParam()));
      return p;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
}

export interface FakeEngine {
  engine: Engine;
  oscillators: FakeNode[];
  /** Every node made, in order. */
  nodes: FakeNode[];
  /** Nodes still connected to the named layer's input. */
  feeding(name: string): FakeNode[];
  /** Wet nodes currently registered, per layer. */
  wets: Map<string, Set<unknown>>;
  wetCount(): number;
  layerNode(name: string): FakeNode;
  calls: string[];
}

export function createFakeEngine(): FakeEngine {
  const oscillators: FakeNode[] = [];
  const nodes: FakeNode[] = [];
  const track = (kind: string) => {
    const n = makeNode(kind);
    nodes.push(n);
    return n;
  };
  const layers = new Map<string, FakeNode>();
  const wets = new Map<string, Set<unknown>>();
  const calls: string[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => track("gain"),
    createBiquadFilter: () => track("biquad"),
    createStereoPanner: () => track("panner"),
    createBufferSource: () => track("source"),
    createOscillator: () => {
      const o = track("osc");
      oscillators.push(o);
      return o;
    },
    createBuffer: () => ({ copyToChannel() {} }),
  };
  const reverbSend = makeNode("reverb");
  const layerNode = (name: string) => {
    let n = layers.get(name);
    if (!n) layers.set(name, (n = makeNode("layer")));
    return n;
  };
  const engine = {
    ctx,
    reverbSend,
    layer: layerNode,
    setMod: () => {},
    addWetMod: (name: string, node: unknown) => {
      let set = wets.get(name);
      if (!set) wets.set(name, (set = new Set()));
      set.add(node);
    },
    removeWetMod: (name: string, node: unknown) => {
      wets.get(name)?.delete(node);
    },
    setMaster: (v: number) => calls.push(`master ${v}`),
    setLayer: (name: string, v: number, glide?: number) =>
      calls.push(`layer ${name} ${v}${glide === undefined ? "" : ` over ${glide}`}`),
    silenceLayer: (name: string, s: number) => calls.push(`silence ${name} over ${s}`),
    setTrim: () => {},
  } as unknown as Engine;
  return {
    engine,
    oscillators,
    nodes,
    feeding: (name) => nodes.filter((n) => n.connections.has(layerNode(name))),
    wets,
    wetCount: () => [...wets.values()].reduce((n, set) => n + set.size, 0),
    layerNode,
    calls,
  };
}
