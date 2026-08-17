import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalActivityService } from "../../../common/terminal-activity/terminal-activity.service";
import type { ShellProfile } from "../../../config/+models/shell-config";
import type { IPty } from "../pty/pty";
import { PTY_ACK_THRESHOLD_BYTES, PtyHandler } from "./pty.handler";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("PtyHandler", () => {
  let handler: PtyHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockPty: IPty;
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
    mockPty = {
      spawn: vi.fn().mockResolvedValue(undefined),
      write: vi.fn(),
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
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
    );
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  describe("registration", () => {
    it("should spawn PTY and register data handlers", async () => {
      handler.registerTerminal(mockTerminal);

      // Wait for async spawn
      await vi.waitFor(() => {
        expect(mockPty.spawn).toHaveBeenCalledWith(terminalId, shellConfig, { cols: 80, rows: 24 });
      });

      expect(mockTerminal.onData).toHaveBeenCalled();
      expect(mockPty.onData).toHaveBeenCalled();
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
      await vi.waitFor(() => expect(mockPty.onData).toHaveBeenCalled());

      const onPtyDataCallback = vi.mocked(mockPty.onData).mock.calls[0][0];

      const chunk1 = bytes("pty output 1");
      onPtyDataCallback(chunk1);

      // onWriteParsed is armed before the first write, and the chunk is written immediately
      expect(mockTerminal.onWriteParsed).toHaveBeenCalledOnce();
      expect(writeSpy).toHaveBeenCalledOnce();
      expect(writeSpy.mock.calls[0][0]).toBe(chunk1);
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
      const chunk2 = bytes("pty output 2");
      onPtyDataCallback(chunk2);
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy.mock.calls[1][0]).toBe(chunk2);
      expect(mockTerminal.onWriteParsed).toHaveBeenCalledOnce();
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe("flow control", () => {
    async function registerAndGetDataCallback() {
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onData).toHaveBeenCalled());
      return vi.mocked(mockPty.onData).mock.calls[0][0];
    }

    /** Runs the write callback (xterm "parsed" signal) for the n-th terminal.write call. */
    function completeWrite(index: number) {
      const callback = vi.mocked(mockTerminal.write).mock.calls[index][1] as () => void;
      callback();
    }

    it("should ack once parsed bytes reach the threshold, not before", async () => {
      const onPtyData = await registerAndGetDataCallback();
      const half = new Uint8Array(PTY_ACK_THRESHOLD_BYTES / 2);

      onPtyData(half);
      onPtyData(half);
      completeWrite(0);
      expect(mockPty.ack).not.toHaveBeenCalled();

      completeWrite(1);
      expect(mockPty.ack).toHaveBeenCalledOnce();
      expect(mockPty.ack).toHaveBeenCalledWith(PTY_ACK_THRESHOLD_BYTES);
    });

    it("should not ack bytes that were never parsed", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(new Uint8Array(PTY_ACK_THRESHOLD_BYTES * 4));
      expect(mockPty.ack).not.toHaveBeenCalled();
    });

    it("should ack the accumulated total and start counting from zero again", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(new Uint8Array(PTY_ACK_THRESHOLD_BYTES - 10));
      onPtyData(new Uint8Array(20));
      onPtyData(new Uint8Array(PTY_ACK_THRESHOLD_BYTES - 10));
      completeWrite(0);
      completeWrite(1);
      completeWrite(2);
      // 1st+2nd cross the threshold together; the 3rd alone stays below it
      expect(vi.mocked(mockPty.ack).mock.calls).toEqual([[PTY_ACK_THRESHOLD_BYTES + 10]]);
    });

    it("should stop acking after dispose", async () => {
      const onPtyData = await registerAndGetDataCallback();
      onPtyData(new Uint8Array(PTY_ACK_THRESHOLD_BYTES));
      handler.dispose();
      completeWrite(0);
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
      const ptyDataDispose = vi.fn();
      const ptyExitDispose = vi.fn();

      vi.mocked(mockTerminal.onData).mockReturnValue({ dispose: terminalDataDispose });
      vi.mocked(mockPty.onData).mockReturnValue({ dispose: ptyDataDispose });
      vi.mocked(mockPty.onExit).mockReturnValue({ dispose: ptyExitDispose });

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      handler.dispose();

      expect(terminalDataDispose).toHaveBeenCalled();
      expect(ptyDataDispose).toHaveBeenCalled();
      expect(ptyExitDispose).toHaveBeenCalled();
    });
  });
});
