// StyleX compiles at build time and the test run skips that plugin, so components that call it
// would throw. Stand in for the runtime calls: styles carry no meaning under jsdom.
import { vi } from "vitest";

vi.mock("@stylexjs/stylex", () => {
  const vars = () => new Proxy({}, { get: (_t, key) => `var(--${String(key)})` });
  return {
    create: (styles: object) => styles,
    props: () => ({}),
    defineVars: vars,
    createTheme: () => ({}),
  };
});
