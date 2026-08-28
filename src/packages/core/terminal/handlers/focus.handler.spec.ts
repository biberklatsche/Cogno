import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { FocusHandler } from "./focus.handler";

describe("FocusHandler", () => {
  let handler: FocusHandler;
  let mockTerminal: Terminal;
  let focusChanges: boolean[];

  function getRegisteredListener(type: "focus" | "blur"): () => void {
    const addEventListener = mockTerminal.textarea?.addEventListener;
    if (!addEventListener) throw new Error("The mock terminal has no textarea.");
    const listener = vi.mocked(addEventListener).mock.calls.find((call) => call[0] === type)?.[1];
    if (typeof listener !== "function") {
      throw new Error(`No ${type} listener registered.`);
    }
    return listener as () => void;
  }

  beforeEach(() => {
    focusChanges = [];
    handler = new FocusHandler((focused) => focusChanges.push(focused));
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it("listens on the terminal's textarea", () => {
    const addEventListenerSpy = vi.spyOn(mockTerminal.textarea!, "addEventListener");

    handler.registerTerminal(mockTerminal);

    expect(addEventListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith("blur", expect.any(Function));
  });

  it("reports and remembers focus when the user clicks in", () => {
    handler.registerTerminal(mockTerminal);

    getRegisteredListener("focus")();

    expect(handler.hasFocus()).toBe(true);
    expect(focusChanges).toEqual([true]);
  });

  it("reports and remembers the loss of focus", () => {
    handler.registerTerminal(mockTerminal);

    getRegisteredListener("focus")();
    getRegisteredListener("blur")();

    expect(handler.hasFocus()).toBe(false);
    expect(focusChanges).toEqual([true, false]);
  });

  it("hands the keyboard to xterm and reports it", () => {
    handler.registerTerminal(mockTerminal);

    handler.focus();

    expect(mockTerminal.focus).toHaveBeenCalled();
    expect(focusChanges).toEqual([true]);
  });
});
