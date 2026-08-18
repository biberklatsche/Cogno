import type { PtyOutputListenerContract, PtyTransportPort } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../../../__test__/mocks/tauri-mock.factory";
import type { ShellConfig } from "../../../config/+models/config";
import { Pty } from "./pty";

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

vi.mock("../../../common/environment/environment", () => ({
  Environment: { isDevMode: () => false },
}));

vi.mock("../../../common/error/error-reporter", () => ({
  ErrorReporter: { reportException: vi.fn() },
}));

describe("Pty", () => {
  let transport: ReturnType<typeof TauriMockFactory.createPtyTransport>;
  let pty: Pty;
  const terminalId = "test-terminal";
  const shellConfig: ShellConfig = { shell_type: "Bash" } as any;
  const dimensions = { cols: 80, rows: 24 };
  const noopListener = () => {};

  beforeEach(() => {
    transport = TauriMockFactory.createPtyTransport();
    pty = new Pty(transport as unknown as PtyTransportPort);
  });

  /** The n-th spawn handle the transport handed out. */
  function spawnHandle(index = 0) {
    return vi.mocked(transport.spawn).mock.results[index].value;
  }

  /** The output listener `Pty` passed to the n-th `transport.spawn`. */
  function outputListener(index = 0): PtyOutputListenerContract {
    return vi.mocked(transport.spawn).mock.calls[index][1];
  }

  /** Makes the next `transport.spawn` stay pending until the returned resolver is called. */
  function holdNextSpawn(): () => void {
    let resolveSpawn!: () => void;
    vi.mocked(transport.spawn).mockImplementationOnce(() => ({
      ready: new Promise<{ shellProcessId: number | null }>((resolve) => {
        resolveSpawn = () => resolve({ shellProcessId: 1234 });
      }),
      closeOutput: vi.fn(),
    }));
    return () => resolveSpawn();
  }

  function chunk(seq: number, text: string) {
    return { seq, data: new TextEncoder().encode(text) };
  }

  it("should spawn through the transport with profile, dimensions and dev mode", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    expect(transport.spawn).toHaveBeenCalledWith(
      { terminalId, cols: 80, rows: 24, profile: shellConfig, devMode: false },
      expect.objectContaining({
        onChunk: expect.any(Function),
        onChunksLost: expect.any(Function),
      }),
    );
  });

  it("should throw error if resize is called before spawn", () => {
    expect(() => pty.resize(dimensions)).toThrow("Please spawn Pty before resize.");
  });

  it("should resize pty if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.resize({ cols: 100, rows: 30 });
    expect(transport.resize).toHaveBeenCalledWith(terminalId, 100, 30);
  });

  it("should ignore invalid resize dimensions", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.resize({ cols: null, rows: null } as any);
    expect(transport.resize).not.toHaveBeenCalled();
  });

  it("should buffer resize until spawn is finished", async () => {
    const resolveSpawn = holdNextSpawn();

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.resize({ cols: 120, rows: 40 });
    expect(transport.resize).not.toHaveBeenCalled();

    resolveSpawn();
    await spawnPromise;

    expect(transport.resize).toHaveBeenCalledWith(terminalId, 120, 40);
  });

  it("should discard invalid buffered resize dimensions", async () => {
    const resolveSpawn = holdNextSpawn();

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.resize({ cols: null, rows: null } as any);

    resolveSpawn();
    await spawnPromise;

    expect(transport.resize).not.toHaveBeenCalled();
  });

  it("should write to pty if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.write("ls\n");
    expect(transport.write).toHaveBeenCalledWith(terminalId, "ls\n");
  });

  it("should execute shell action if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.executeLineEditorAction("clearLine", { start: 0 });
    expect(transport.executeLineEditorAction).toHaveBeenCalledWith(terminalId, "clearLine", {
      start: 0,
    });
  });

  it("should hand output to the data listener from before the spawn settles", async () => {
    const listener = vi.fn();
    const resolveSpawn = holdNextSpawn();

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions, listener);
    // Output arriving while the spawn is still pending reaches the listener.
    outputListener().onChunk(chunk(0, "hello"));
    expect(listener).toHaveBeenCalledWith(chunk(0, "hello"));

    resolveSpawn();
    await spawnPromise;
    outputListener().onChunk(chunk(1, "world"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should report chunks the transport gave up as lost", async () => {
    const { ErrorReporter } = await import("../../../common/error/error-reporter");
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);

    outputListener().onChunksLost(3, 5);

    expect(ErrorReporter.reportException).toHaveBeenCalledWith(
      expect.objectContaining({
        handled: true,
        source: "Pty",
        context: expect.objectContaining({ fromSeq: 3, toSeq: 5, terminalId }),
      }),
    );
  });

  it("should forward acks by sequence number to the backend", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.ack(42);
    expect(transport.ack).toHaveBeenCalledWith(terminalId, 42);
  });

  it("should not ack after dispose", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.dispose();
    pty.ack(1);
    expect(transport.ack).not.toHaveBeenCalled();
  });

  it("should kill the session that a spawn in flight produces after dispose", async () => {
    const resolveSpawn = holdNextSpawn();

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.dispose();
    // No session exists yet, so nothing to kill at this point.
    expect(transport.kill).not.toHaveBeenCalled();

    resolveSpawn();
    await spawnPromise;

    expect(transport.kill).toHaveBeenCalledWith(terminalId);
    expect(spawnHandle().closeOutput).toHaveBeenCalled();
    expect(transport.resize).not.toHaveBeenCalled();
  });

  it("should close the output on dispose", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.dispose();
    expect(spawnHandle().closeOutput).toHaveBeenCalled();
  });

  it("should listen to exit", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    const listener = vi.fn();
    const disposable = pty.onExit(listener);

    expect(transport.onExit).toHaveBeenCalledWith(terminalId, listener);
    disposable.dispose();
  });

  it("should kill pty on dispose", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.dispose();
    expect(transport.kill).toHaveBeenCalledWith(terminalId);
  });
});
