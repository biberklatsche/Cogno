import { beforeEach, describe, expect, it } from "vitest";
import { KeybindingMatcher } from "./keybind.matcher";
import type { KeyboardMapping } from "./keyboard/keyboard-layouts/_.contribution";

function makeEvent(
  init: KeyboardEventInit & {
    key?: string;
    code?: string;
    payload?: "keydown" | "keyup";
  } = {},
): KeyboardEvent {
  const payload = init.payload ?? "keydown";
  const e = new KeyboardEvent(payload, init);
  Object.defineProperty(e, "code", { value: init.code ?? "", configurable: true });
  Object.defineProperty(e, "key", { value: init.key ?? "", configurable: true });
  return e as KeyboardEvent;
}

describe("KeybindingMatcher (linux)", () => {
  let matcher: KeybindingMatcher;

  beforeEach(() => {
    matcher = new KeybindingMatcher();
    // Provide a minimal default keyCode mapping for letter keys used in tests
    matcher.initKeyCodeMapping({
      KeyA: "A",
      KeyK: "K",
      KeyN: "N",
      KeyC: "C",
    } as unknown as KeyboardMapping);
  });

  it("matches a simple keybinding with Control+Shift in any order in the binding string", () => {
    matcher.initBindings(["Shift+Ctrl+A=doA"]);

    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, shiftKey: true });
    const action = matcher.match(event);

    expect(action?.event.payload).toEqual("doA");
  });

  it("should override the first binding", () => {
    matcher.initBindings(["Shift+Ctrl+A=doA", "Shift+Ctrl+A=doB"]);

    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, shiftKey: true });
    const action = matcher.match(event);

    expect(action?.event.payload).toBe("doB");
  });

  it("uses keyCodeMapping to resolve the main key from event.code", () => {
    const mapping: KeyboardMapping = { KeyY: "Z" } as const; // e.g., on German layout Y key produces Z
    matcher.initKeyCodeMapping(mapping);
    matcher.initBindings(["Ctrl+Z=undo"]);

    const event = makeEvent({ key: "y", code: "KeyY", ctrlKey: true });
    const action = matcher.match(event);

    expect(action?.event.payload).toBe("undo");
  });

  it('supports Meta modifier on Linux using "Meta" keyword', () => {
    matcher.initBindings(["Meta+K=openCommandPalette"]);

    const event = makeEvent({ key: "k", code: "KeyK", metaKey: true });
    const action = matcher.match(event);

    expect(action?.event.payload).toBe("openCommandPalette");
  });

  it("should match Alt+Control and Control+Alt as same action", () => {
    matcher.initBindings(["Alt+Ctrl+A=doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
  });

  it("should support one trigger", () => {
    matcher.initBindings(["Alt+Ctrl+A=[all]doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
  });

  it("should support many triggers", () => {
    matcher.initBindings(["Alt+Ctrl+A=[all:unconsumed:performable]doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
    expect(action?.event.trigger?.unconsumed).toBe(true);
    expect(action?.event.trigger?.performable).toBe(true);
  });

  it("should support one arg", () => {
    matcher.initBindings(["Alt+Ctrl+A=doA:abc"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.args).toContain("abc");
  });

  it("should support many args", () => {
    matcher.initBindings(["Alt+Ctrl+A=[all]doA:a:b:c"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.args).toContain("a");
    expect(action?.event.args).toContain("b");
    expect(action?.event.args).toContain("c");
  });

  it("supports key sequence: Ctrl+A then N triggers new_window", () => {
    matcher.initBindings(["Ctrl+A>N=new_window"]);

    const step1 = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const step2 = makeEvent({ key: "n", code: "KeyN" });

    const action1 = matcher.match(step1);
    expect(action1).toBeUndefined();

    const action2 = matcher.match(step2);
    expect(action2?.event.payload).toBe("new_window");
  });

  it("sequence: mismatch should not trigger and should reset", () => {
    matcher.initBindings(["Ctrl+A>N=new_window"]);

    const step1 = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const wrong = makeEvent({ key: "x", code: "KeyK" }); // any non-matching second step
    const nAlone = makeEvent({ key: "n", code: "KeyN" });

    expect(matcher.match(step1)).toBeUndefined();
    expect(matcher.match(wrong)).toBeUndefined();
    // After mismatch, 'n' alone should not fire because sequence restart is required
    expect(matcher.match(nAlone)).toBeUndefined();

    // Now complete the proper sequence
    expect(matcher.match(step1)).toBeUndefined();
    expect(matcher.match(nAlone)?.event.payload).toBe("new_window");
  });

  it("sequence retains triggers and args parsing", () => {
    matcher.initBindings(["Ctrl+A>N=[all]doA:x:y"]);

    const step1 = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const step2 = makeEvent({ key: "n", code: "KeyN" });

    expect(matcher.match(step1)).toBeUndefined();
    const action = matcher.match(step2);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
    expect(action?.event.args).toEqual(["x", "y"]);
  });

  it("supports all: prefix on keybind side", () => {
    matcher.initBindings(["all:Alt+Ctrl+A=doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
  });

  it("supports unconsumed: prefix on keybind side", () => {
    matcher.initBindings(["unconsumed:Ctrl+A=doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.unconsumed).toBe(true);
  });

  it("supports performable: prefix on keybind side", () => {
    matcher.initBindings(["performable:Ctrl+A=doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.performable).toBe(true);
  });

  it("supports multiple prefixes on keybind side", () => {
    matcher.initBindings(["all:unconsumed:performable:Alt+Ctrl+A=doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
    expect(action?.event.trigger?.unconsumed).toBe(true);
    expect(action?.event.trigger?.performable).toBe(true);
  });

  it("merges keybind-side prefix with action-side trigger", () => {
    matcher.initBindings(["all:Ctrl+A=[unconsumed]doA"]);
    const event = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("doA");
    expect(action?.event.trigger?.all).toBe(true);
    expect(action?.event.trigger?.unconsumed).toBe(true);
  });

  it("ignores keyup events for matching", () => {
    matcher.initBindings(["Ctrl+A=doA"]);
    const up = makeEvent({ key: "a", code: "KeyA", ctrlKey: true, payload: "keyup" });
    expect(matcher.match(up)).toBeUndefined();
  });

  it("should override same action names", () => {
    matcher.initBindings(["Ctrl+B=doA", "Ctrl+A=doA"]);

    const eventB = makeEvent({ key: "b", code: "KeyB", ctrlKey: true });
    const eventA = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });

    expect(matcher.match(eventA)?.event.payload).toEqual("doA");
    expect(matcher.match(eventB)?.event.payload).toBeUndefined();
  });

  it("should override same action names twice", () => {
    matcher.initBindings(["Ctrl+B=doA", "Ctrl+A=doA"]);
    matcher.initBindings(["Ctrl+B=doA", "Ctrl+C=doA"]);

    const eventC = makeEvent({ key: "c", code: "KeyC", ctrlKey: true });
    const eventB = makeEvent({ key: "b", code: "KeyB", ctrlKey: true });
    const eventA = makeEvent({ key: "a", code: "KeyA", ctrlKey: true });

    expect(matcher.match(eventC)?.event.payload).toEqual("doA");
    expect(matcher.match(eventA)?.event.payload).toBeUndefined();
    expect(matcher.match(eventB)?.event.payload).toBeUndefined();
  });
});

describe("KeybindingMatcher (macos)", () => {
  let matcher: KeybindingMatcher;

  beforeEach(() => {
    matcher = new KeybindingMatcher();
    matcher.initKeyCodeMapping({
      KeyA: "A",
      KeyK: "K",
      KeyN: "N",
    } as unknown as KeyboardMapping);
  });

  it("maps metaKey to Command on macOS", () => {
    matcher.initBindings(["Command+K=openCommandPalette"]);

    const event = makeEvent({ key: "k", code: "KeyK", metaKey: true });
    const action = matcher.match(event);

    expect(action?.event.payload).toBe("openCommandPalette");
  });

  it("maps altKey to Option on macOS", () => {
    matcher.initBindings(["Option+A=optAction"]);
    const event = makeEvent({ key: "a", code: "KeyA", altKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("optAction");
  });

  it('maps ctrlKey to Control on macOS (not "Ctrl")', () => {
    matcher.initBindings(["Control+K=controlAction"]);
    const event = makeEvent({ key: "k", code: "KeyK", ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("controlAction");
  });

  it("supports combined modifiers with any order, using mac labels", () => {
    matcher.initBindings(["Option+Control+A=combo"]);
    const event = makeEvent({ key: "a", code: "KeyA", altKey: true, ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.event.payload).toBe("combo");
  });

  it("supports sequences on macOS using Command label", () => {
    matcher.initBindings(["Command+K>A=action"]);
    const step1 = makeEvent({ key: "k", code: "KeyK", metaKey: true });
    const step2 = makeEvent({ key: "a", code: "KeyA" });

    expect(matcher.match(step1)).toBeUndefined();
    expect(matcher.match(step2)?.event.payload).toBe("action");
  });

  it("should override same action names", () => {
    matcher.initBindings(["Meta+B=doA", "Meta+A=doA"]);
    const eventB = makeEvent({ key: "b", code: "KeyB", metaKey: true });
    const eventA = makeEvent({ key: "a", code: "KeyA", metaKey: true });
    expect(matcher.match(eventA)?.event.payload).toEqual("doA");
    expect(matcher.match(eventB)?.event.payload).toBeUndefined();
  });
});
