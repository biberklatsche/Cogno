import { FocusHandler } from "@cogno/core/terminal/handlers/focus.handler";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { TerminalStateManager } from "../state";
import { TerminalFocusCoordinator } from "./terminal-focus.coordinator";

describe("TerminalFocusCoordinator", () => {
  const terminalId = "test-terminal-id";
  let handler: FocusHandler;
  let coordinator: TerminalFocusCoordinator;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let stateManager: TerminalStateManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBus = new AppBus();
    stateManager = {
      setFocus: vi.fn(),
      clearUnreadNotification: vi.fn(),
    } as unknown as TerminalStateManager;
    handler = new FocusHandler((focused) => coordinator.onFocusChanged(focused));
    coordinator = new TerminalFocusCoordinator(terminalId, mockBus, stateManager, handler);
    mockTerminal = TerminalMockFactory.createTerminal();
    handler.registerTerminal(mockTerminal);
  });

  it("focuses the terminal when FocusTerminal names it", () => {
    const focusSpy = vi.spyOn(mockTerminal, "focus");
    const publishSpy = vi.spyOn(mockBus, "publish");

    mockBus.publish({
      type: "FocusTerminal",
      payload: terminalId,
      path: ["app", "terminal"],
      phase: "target",
    });

    expect(focusSpy).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TerminalFocused", payload: terminalId }),
    );
    expect(stateManager.setFocus).toHaveBeenCalledWith(true);
    expect(stateManager.clearUnreadNotification).toHaveBeenCalled();
  });

  it("blurs the terminal when FocusTerminal names another one", () => {
    const blurSpy = vi.spyOn(mockTerminal, "blur");
    const publishSpy = vi.spyOn(mockBus, "publish");

    mockBus.publish({
      type: "FocusTerminal",
      payload: "other-id",
      path: ["app", "terminal"],
      phase: "target",
    });

    expect(blurSpy).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TerminalBlurred", payload: terminalId }),
    );
    expect(stateManager.setFocus).toHaveBeenCalledWith(false);
  });

  it("focuses shortly after the pty came up", () => {
    const focusSpy = vi.spyOn(mockTerminal, "focus");

    mockBus.publish({
      type: "PtyInitialized",
      payload: { terminalId: terminalId, shellType: "Bash" },
      path: ["app", "terminal", terminalId],
      phase: "target",
    });

    vi.advanceTimersByTime(50);
    expect(focusSpy).toHaveBeenCalled();
  });

  it("blurs the terminal when BlurTerminal names it", () => {
    const blurSpy = vi.spyOn(mockTerminal, "blur");

    mockBus.publish({
      type: "BlurTerminal",
      payload: terminalId,
      path: ["app", "terminal"],
      phase: "target",
    });

    expect(blurSpy).toHaveBeenCalled();
  });

  it("stops listening once disposed", () => {
    const focusSpy = vi.spyOn(mockTerminal, "focus");
    coordinator.dispose();

    mockBus.publish({
      type: "FocusTerminal",
      payload: terminalId,
      path: ["app", "terminal"],
      phase: "target",
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });
});
