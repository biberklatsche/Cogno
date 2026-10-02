import type { IPty } from "@cogno/core/terminal/pty";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { SessionModel } from "../model/session-model";
import { InputHandler } from "./input.handler";

describe("InputHandler", () => {
  let handler: InputHandler;
  let mockTerminal: Terminal;
  let model: Pick<SessionModel, "clearUnreadNotification">;
  let mockPty: Pick<IPty, "write">;

  beforeEach(() => {
    model = { clearUnreadNotification: vi.fn() };
    mockPty = { write: vi.fn() };
    handler = new InputHandler(model as SessionModel, mockPty as IPty);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it("clears the unread notification when the user types", () => {
    let terminalOnDataCallback: ((data: string) => void) | undefined;
    mockTerminal = TerminalMockFactory.createTerminal({
      onData: (callback) => {
        terminalOnDataCallback = callback;
        return { dispose: vi.fn() };
      },
    });

    handler.registerTerminal(mockTerminal);
    terminalOnDataCallback?.("ls");

    expect(model.clearUnreadNotification).toHaveBeenCalled();
  });

  it("clears the terminal on request", () => {
    const clearSpy = vi.spyOn(mockTerminal, "clear");
    handler.registerTerminal(mockTerminal);

    handler.clearBuffer();

    expect(clearSpy).toHaveBeenCalled();
  });

  it("writes text to the pty as if typed", () => {
    handler.registerTerminal(mockTerminal);

    handler.writeRaw("hello");

    expect(mockPty.write).toHaveBeenCalledWith("hello");
  });

  it("no longer touches the terminal after dispose", () => {
    const clearSpy = vi.spyOn(mockTerminal, "clear");
    handler.registerTerminal(mockTerminal);
    handler.dispose();

    handler.clearBuffer();

    expect(clearSpy).not.toHaveBeenCalled();
  });
});
