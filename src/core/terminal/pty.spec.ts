import type {
  PtyOutputListenerContract,
  PtyShellProfileContract,
  PtyTransport,
} from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../__test__/mocks/tauri-mock.factory";
import { Pty } from "./pty";
import type { TerminalMachineFault } from "./terminal-machine.events";

vi.mock("@cogno/platform/logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

describe("Pty", () => {
  let transport: ReturnType<typeof TauriMockFactory.createPtyTransport>;
  let pty: Pty;
  const terminalId = "test-terminal";
  const shellConfig: PtyShellProfileContract = {
    shell_type: "Bash",
    inject_cogno_cli: false,
    enable_shell_integration: false,
    load_user_rc: false,
  };
  const dimensions = { cols: 80, rows: 24 };
  const noopListener = () => {};

  beforeEach(() => {
    transport = TauriMockFactory.createPtyTransport();
    pty = new Pty(transport as unknown as PtyTransport, false);
  });

  /** The n-th spawn handle the transport handed out. */
  function spawnHandle(index = 0) {
    return vi.mocked(transport.spawn).mock.results[index].value;
  }

  /** The output listener `Pty` passed to the n-th `transport.spawn`. */
  function outputListener(index = 0): PtyOutputListenerContract {
    const calls = vi.mocked(transport.spawn).mock.calls as unknown as Parameters<
      PtyTransport["spawn"]
    >[];
    return calls[index][1];
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

  /** Starts a spawn and resolves once the transport has been asked for the shell. */
  async function spawnInFlight(onData = noopListener): Promise<{ settled: Promise<void> }> {
    const settled = pty.spawn(terminalId, shellConfig, dimensions, onData);
    await vi.waitFor(() => expect(transport.spawn).toHaveBeenCalled());
    return { settled };
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

    const { settled: spawnPromise } = await spawnInFlight();
    pty.resize({ cols: 120, rows: 40 });
    expect(transport.resize).not.toHaveBeenCalled();

    resolveSpawn();
    await spawnPromise;

    expect(transport.resize).toHaveBeenCalledWith(terminalId, 120, 40);
  });

  it("should discard invalid buffered resize dimensions", async () => {
    const resolveSpawn = holdNextSpawn();

    const { settled: spawnPromise } = await spawnInFlight();
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

  it("should close the output if the spawn rejects, instead of leaking the channel registration", async () => {
    const closeOutput = vi.fn();
    const error = new Error("spawn failed");
    vi.mocked(transport.spawn).mockReturnValueOnce({
      ready: Promise.reject(error),
      closeOutput,
    });

    await expect(pty.spawn(terminalId, shellConfig, dimensions, noopListener)).rejects.toThrow(
      "spawn failed",
    );
    expect(closeOutput).toHaveBeenCalled();
  });

  it("should hand output to the data listener from before the spawn settles", async () => {
    const listener = vi.fn();
    const resolveSpawn = holdNextSpawn();

    const { settled: spawnPromise } = await spawnInFlight(listener);
    // Output arriving while the spawn is still pending reaches the listener.
    outputListener().onChunk(chunk(0, "hello"));
    expect(listener).toHaveBeenCalledWith(chunk(0, "hello"));

    resolveSpawn();
    await spawnPromise;
    outputListener().onChunk(chunk(1, "world"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reports chunks the transport gave up as a fault rather than handling it", async () => {
    const faults: TerminalMachineFault[] = [];
    pty.faults$.subscribe((fault) => faults.push(fault));
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);

    outputListener().onChunksLost(3, 5);

    expect(faults).toHaveLength(1);
    expect(faults[0].operation).toBe("onData");
    expect(faults[0].context).toMatchObject({ fromSeq: 3, toSeq: 5, terminalId });
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

    const { settled: spawnPromise } = await spawnInFlight();
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

  /** The exit listener `Pty` passed to the n-th `transport.onExit`. */
  function backendExit(index = 0): (exit: { exitCode: number }) => void {
    return vi.mocked(transport.onExit).mock.calls[index][1];
  }

  it("listens for the exit before the shell is spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);

    expect(transport.onExit).toHaveBeenCalledWith(terminalId, expect.any(Function));
    expect(vi.mocked(transport.onExit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(transport.spawn).mock.invocationCallOrder[0],
    );
  });

  it("tells a listener about an exit that happened before it subscribed", async () => {
    const resolveSpawn = holdNextSpawn();
    const { settled: spawnPromise } = await spawnInFlight();

    backendExit()({ exitCode: 3 });
    resolveSpawn();
    await spawnPromise;
    const listener = vi.fn();
    pty.onExit(listener);

    expect(listener).toHaveBeenCalledWith({ exitCode: 3 });
  });

  it("stops telling a listener once it is disposed", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    const listener = vi.fn();
    pty.onExit(listener).dispose();

    backendExit()({ exitCode: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("drops the exit listener and spawns nothing when disposed while it registers", async () => {
    const unlisten = vi.fn();
    let registerListener!: () => void;
    vi.mocked(transport.onExit).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          registerListener = () => resolve(unlisten);
        }),
    );
    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions, noopListener);

    pty.dispose();
    registerListener();
    await spawnPromise;

    expect(unlisten).toHaveBeenCalled();
    expect(transport.spawn).not.toHaveBeenCalled();
  });

  it("releases the exit listener on dispose", async () => {
    const unlisten = vi.fn();
    vi.mocked(transport.onExit).mockResolvedValueOnce(unlisten);
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);

    pty.dispose();

    expect(unlisten).toHaveBeenCalled();
  });

  it("should kill pty on dispose", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.dispose();
    expect(transport.kill).toHaveBeenCalledWith(terminalId);
  });
});
