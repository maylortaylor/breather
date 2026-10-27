import { describe, expect, it } from "vitest";
import { createInstaller, type InstallEnv, type InstallEvent } from "./install";

function rig(env: Partial<InstallEnv> = {}) {
  const target = new EventTarget();
  const inst = createInstaller(target as unknown as Window, {
    isPhone: () => true,
    isInstalled: () => false,
    ...env,
  });
  const fire = (outcome = "accepted") => {
    const ev = new Event("beforeinstallprompt", { cancelable: true }) as InstallEvent;
    const calls: string[] = [];
    ev.prompt = async () => void calls.push("prompt");
    ev.userChoice = Promise.resolve({ outcome });
    target.dispatchEvent(ev);
    return { ev, calls };
  };
  return { inst, target, fire };
}

describe("installer", () => {
  it("offers nothing until the browser says the app can install", () => {
    expect(rig().inst.canInstall()).toBe(false);
  });

  it("offers install on a phone once the event fires, and holds Chrome's own prompt back", () => {
    const s = rig();
    const { ev } = s.fire();
    expect(ev.defaultPrevented).toBe(true);
    expect(s.inst.canInstall()).toBe(true);
  });

  it("never offers on a desktop or when already installed", () => {
    const desktop = rig({ isPhone: () => false });
    desktop.fire();
    expect(desktop.inst.canInstall()).toBe(false);
    const installed = rig({ isInstalled: () => true });
    installed.fire();
    expect(installed.inst.canInstall()).toBe(false);
  });

  it("install shows the dialog once, reports the choice and hides the button", async () => {
    const s = rig();
    const { calls } = s.fire("accepted");
    expect(await s.inst.install()).toBe(true);
    expect(calls).toEqual(["prompt"]);
    expect(s.inst.canInstall()).toBe(false);
    expect(await s.inst.install()).toBe(false);
  });

  it("a dismissed dialog resolves false", async () => {
    const s = rig();
    s.fire("dismissed");
    expect(await s.inst.install()).toBe(false);
  });

  it("hides the button after the app is installed", () => {
    const s = rig();
    s.fire();
    s.target.dispatchEvent(new Event("appinstalled"));
    expect(s.inst.canInstall()).toBe(false);
  });
});
