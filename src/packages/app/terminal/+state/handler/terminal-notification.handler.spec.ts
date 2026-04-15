import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { TerminalStateManager } from "../state";
import { TerminalNotificationHandler } from "./terminal-notification.handler";

describe("TerminalNotificationHandler", () => {
  let handler: TerminalNotificationHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockStateManager: Pick<
    TerminalStateManager,
    "markUnreadNotification" | "setProgress" | "terminalId"
  >;

  beforeEach(() => {
    mockBus = new AppBus();
    mockStateManager = {
      markUnreadNotification: vi.fn(),
      setProgress: vi.fn(),
      terminalId: "test-terminal-id",
    };
    handler = new TerminalNotificationHandler(mockBus, mockStateManager as TerminalStateManager);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it("registers OSC handler for 9", () => {
    handler.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(9, expect.any(Function));
  });

  it("publishes Notification when OSC 9 is received", () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    handler.registerTerminal(mockTerminal);

    const oscHandler = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === 9)?.[1];

    const result = oscHandler("Build completed successfully");

    expect(result).toBe(true);
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Notification",
        path: ["notification"],
        payload: expect.objectContaining({
          header: "Terminal Notification",
          body: "Build completed successfully",
          type: "info",
          terminalId: "test-terminal-id",
        }),
      }),
    );
    expect(mockStateManager.markUnreadNotification).toHaveBeenCalledTimes(1);
  });

  it("ignores empty OSC 9 payloads", () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    handler.registerTerminal(mockTerminal);
    const oscHandler = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === 9)?.[1];

    const result = oscHandler("   \n\r   ");

    expect(result).toBe(true);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("updates terminal progress for OSC 9;4 progress payloads", () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    handler.registerTerminal(mockTerminal);
    const oscHandler = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === 9)?.[1];

    const result = oscHandler("4;1;42");

    expect(result).toBe(true);
    expect(mockStateManager.setProgress).toHaveBeenCalledWith("default", 42);
    expect(mockStateManager.markUnreadNotification).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("hides terminal progress for OSC 9;4 reset payloads", () => {
    handler.registerTerminal(mockTerminal);
    const oscHandler = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === 9)?.[1];

    const result = oscHandler("4;0;0");

    expect(result).toBe(true);
    expect(mockStateManager.setProgress).toHaveBeenCalledWith("hidden", 0);
  });

  it("disposes registered handlers", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
    handler.registerTerminal(mockTerminal);

    handler.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
