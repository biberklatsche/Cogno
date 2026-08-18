import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalActivityService } from "../../../common/terminal-activity/terminal-activity.service";
import type { ShellProfile } from "../../../config/+models/shell-config";
import type { IPty } from "../pty/pty";
import { HIDDEN_UNPARSED_BUDGET_BYTES, PtyHandler } from "./pty.handler";

function chunk(seq: number, payload: string | number): { seq: number; data: Uint8Array } {
  const data =
    typeof payload === "string" ? new TextEncoder().encode(payload) : new Uint8Array(payload);
  return { seq, data };
}

/** Lets the coalesced ack microtask run. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PtyHandler", () => {
  let handler: PtyHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockPty: IPty;
  let windowHidden = false;
  const terminalId = "test-terminal-id";
  const shellConfig: ShellProfile = {
    path: "bash",
    shell_type: "Bash",
    inject_cogno_cli: false,
    enable_shell_integration: false,
    load_user_rc: true,
  };

  beforeEach(() => {
    mockBus = new AppBus();
    windowHidden = false;
    mockPty = {
      spawn: vi.fn().mockResolvedValue(undefined),
      write: vi.fn(),
      onExit: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      resize: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn(),
      kill: vi.fn(),
    } as unknown as IPty;

    handler = new PtyHandler(
      terminalId,
      mockPty,
      shellConfig,
      mockBus,
      new TerminalActivityService(),
      () => windowHidden,
    );
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  /** The chunk listener the handler passed to `IPty.spawn`. */
  function ptyDataCallback() {
    return vi.mocked(mockPty.spawn).mock.calls[0][3];
  }

  describe("registration", () => {
    it("should spawn PTY and register data handlers", async () => {
      handler.registerTerminal(mockTerminal);

      // Wait for async spawn
      await vi.waitFor(() => {
        expect(mockPty.spawn).toHaveBeenCalledWith(
          terminalId,
          shellConfig,
          { cols: 80, rows: 24 },
          expect.any(Function),
        );
      });

      expect(mockTerminal.onData).toHaveBeenCalled();
      expect(mockPty.onExit).toHaveBeenCalled();
    });
  });

  describe("data flow", () => {
    it("should write terminal data to PTY", async () => {
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockTerminal.onData).toHaveBeenCalled());

      const onDataCallback = vi.mocked(mockTerminal.onData).mock.calls[0][0];
      onDataCallback("user input");

      expect(mockPty.write).toHaveBeenCalledWith("user input");
    });

    it("should write PTY data to terminal in order and publish PtyInitialized after the first parse", async () => {
      const publishSpy = vi.spyOn(mockBus, "publish");
      const writeSpy = vi.spyOn(mockTerminal, "write");
      const onWriteParsedDispose = vi.fn();
      let onWriteParsedCallback: any;
      vi.mocked(mockTerminal.onWriteParsed).mockImplementation((cb) => {
        onWriteParsedCallback = cb;
        return { dispose: onWriteParsedDispose };
      });

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.spawn).toHaveBeenCalled());

      const onPtyDataCallback = ptyDataCallback();

      const chunk1 = chunk(0, "pty output 1");
      onPtyDataCallback(chunk1);

      // onWriteParsed is armed before the first write, and the chunk is written immediately
      expect(mockTerminal.onWriteParsed).toHaveBeenCalledOnce();
      expect(writeSpy).toHaveBeenCalledOnce();
      expect(writeSpy.mock.calls[0][0]).toBe(chunk1.data);
      expect(publishSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "PtyInitialized" }),
      );

      onWriteParsedCallback();

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PtyInitialized",
          payload: expect.objectContaining({
            terminalId: terminalId,
          }),
        }),
      );
      expect(onWriteParsedDispose).toHaveBeenCalled();

      // Second chunk: written as-is, no second PtyInitialized
      publishSpy.mockClear();
      const chunk2 = chunk(1, "pty output 2");
      onPtyDataCallback(chunk2);
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy.mock.calls[1][0]).toBe(chunk2.data);
      expect(mockTerminal.onWriteParsed).toHaveBeenCalledOnce();
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe("flow control", () => {
    async function registerAndGetDataCallback() {
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.spawn).toHaveBeenCalled());
      return ptyDataCallback();
    }

    /** Runs the write callback (xterm "parsed" signal) for the n-th terminal.write call. */
    function completeWrite(index: number) {
      const callback = vi.mocked(mockTerminal.write).mock.calls[index][1] as () => void;
      callback();
    }

    it("should ack the newest parsed sequence number, never unparsed chunks", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(chunk(0, 100));
      onPtyData(chunk(1, 100));
      onPtyData(chunk(2, 100));
      await flushMicrotasks();
      expect(mockPty.ack).not.toHaveBeenCalled();

      completeWrite(0);
      await flushMicrotasks();
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[0]]);

      completeWrite(1);
      completeWrite(2);
      await flushMicrotasks();
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[0], [2]]);
    });

    it("should coalesce the acks of chunks parsed in one slice into a single ack", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(chunk(0, 10));
      onPtyData(chunk(1, 10));
      onPtyData(chunk(2, 10));
      completeWrite(0);
      completeWrite(1);
      completeWrite(2);
      expect(mockPty.ack).not.toHaveBeenCalled(); // not before the microtask
      await flushMicrotasks();
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[2]]);
    });

    it("should not repeat an ack when nothing new was parsed", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(chunk(0, 10));
      completeWrite(0);
      await flushMicrotasks();
      completeWrite(0); // duplicate parse signal
      await flushMicrotasks();
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[0]]);
    });

    it("should stop acking after dispose", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(chunk(0, 10));
      handler.dispose();
      completeWrite(0);
      await flushMicrotasks();
      expect(mockPty.ack).not.toHaveBeenCalled();
    });

    it("should ack on receipt while the window is hidden, within the unparsed budget", async () => {
      const onPtyData = await registerAndGetDataCallback();
      windowHidden = true;

      onPtyData(chunk(0, HIDDEN_UNPARSED_BUDGET_BYTES / 2));
      onPtyData(chunk(1, HIDDEN_UNPARSED_BUDGET_BYTES / 2));
      await flushMicrotasks();
      // Both fit into the budget: acked although xterm parsed nothing yet.
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[1]]);

      onPtyData(chunk(2, 1));
      await flushMicrotasks();
      // Budget exhausted: chunk 2 waits for the parse like in the visible case.
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[1]]);

      completeWrite(0);
      completeWrite(1);
      completeWrite(2);
      await flushMicrotasks();
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[1], [2]]);
    });

    it("should ack only parsed chunks while the window is visible", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(chunk(0, 10));
      await flushMicrotasks();
      expect(mockPty.ack).not.toHaveBeenCalled();
    });
  });

  describe("exit handling", () => {
    it("should publish RemovePane when PTY exits", async () => {
      const publishSpy = vi.spyOn(mockBus, "publish");

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      const onExitCallback = vi.mocked(mockPty.onExit).mock.calls[0][0];
      onExitCallback({ exitCode: 0 });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RemovePane",
          payload: terminalId,
        }),
      );
    });

    it("should publish RemovePane when PowerShell exits abnormally", async () => {
      const publishSpy = vi.spyOn(mockBus, "publish");
      const powerShellProfile: ShellProfile = {
        path: "powershell.exe",
        shell_type: "PowerShell",
        inject_cogno_cli: false,
        enable_shell_integration: false,
        load_user_rc: true,
      };
      handler = new PtyHandler(
        terminalId,
        mockPty,
        powerShellProfile,
        mockBus,
        new TerminalActivityService(),
      );

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      const onExitCallback = vi.mocked(mockPty.onExit).mock.calls[0][0];
      onExitCallback({ exitCode: -2146232797 });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RemovePane",
          payload: terminalId,
        }),
      );
      expect(mockPty.spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Lifecycle", () => {
    it("should dispose all registered handlers", async () => {
      const terminalDataDispose = vi.fn();
      const ptyExitDispose = vi.fn();

      vi.mocked(mockTerminal.onData).mockReturnValue({ dispose: terminalDataDispose });
      vi.mocked(mockPty.onExit).mockReturnValue({ dispose: ptyExitDispose });

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      handler.dispose();

      expect(terminalDataDispose).toHaveBeenCalled();
      expect(ptyExitDispose).toHaveBeenCalled();
    });
  });
});
