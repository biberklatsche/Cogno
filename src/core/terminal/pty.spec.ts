import {
  HostError,
  type PtyOutputListenerContract,
  type PtyShellProfileContract,
  type PtyTransport,
} from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../__test__/mocks/tauri-mock.factory";
import { Pty, PtyOptions } from "./pty";
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

  const options: PtyOptions = { lifetime: "endsWithClient", integrationVersion: "1.3.0" };

  function ptyWith(more: Partial<PtyOptions>): Pty {
    return new Pty(transport as unknown as PtyTransport, { ...options, ...more });
  }

  beforeEach(() => {
    transport = TauriMockFactory.createPtyTransport();
    pty = ptyWith({});
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
      channel: 1,
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

  it("should spawn through the transport with profile, size, integration and lifetime", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    expect(transport.spawn).toHaveBeenCalledWith(
      {
        terminalId,
        size: { cols: 80, rows: 24 },
        profile: shellConfig,
        integrationVersion: "1.3.0",
        lifetime: "endsWithClient",
      },
      expect.objectContaining({
        onChunk: expect.any(Function),
        onChunksLost: expect.any(Function),
      }),
    );
  });

  it("sends no resize before it opened", () => {
    pty.resize(dimensions);
    expect(transport.resize).not.toHaveBeenCalled();
  });

  it("should resize pty if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    pty.resize({ cols: 100, rows: 30 });
    expect(transport.resize).toHaveBeenCalledWith(terminalId, { cols: 100, rows: 30 });
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

    expect(transport.resize).toHaveBeenCalledWith(terminalId, { cols: 120, rows: 40 });
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
      channel: 1,
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
    expect(transport.ack).toHaveBeenCalledWith(terminalId, 1, 42);
  });

  it("reports a failure that only raced the end of its session as nothing", async () => {
    const faults: TerminalMachineFault[] = [];
    pty.faults$.subscribe((fault) => faults.push(fault));
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    vi.mocked(transport.ack).mockRejectedValueOnce(new HostError("sessionNotFound", "gone"));
    vi.mocked(transport.write).mockRejectedValueOnce(new HostError("attachedElsewhere", "taken"));
    vi.mocked(transport.resize).mockRejectedValueOnce(new HostError("io", "broken"));

    pty.ack(1);
    pty.write("x");
    pty.resize({ cols: 90, rows: 30 });
    await vi.waitFor(() => expect(faults).toHaveLength(1));

    expect(faults[0].operation).toBe("resize");
  });

  it("acks output that arrives before the host answered, so its reader is not held back", async () => {
    const resolveSpawn = holdNextSpawn();
    await spawnInFlight();

    pty.ack(7);

    expect(transport.ack).toHaveBeenCalledWith(terminalId, 1, 7);
    resolveSpawn();
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
  function backendExit(index = 0): (exit: { reason: { kind: "exited"; code: number } }) => void {
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

    backendExit()({ reason: { kind: "exited", code: 3 } });
    resolveSpawn();
    await spawnPromise;
    const listener = vi.fn();
    pty.onExit(listener);

    expect(listener).toHaveBeenCalledWith({ reason: { kind: "exited", code: 3 } });
  });

  it("is not live when its shell ended before the host answered", async () => {
    const resolveSpawn = holdNextSpawn();
    const { settled: spawnPromise } = await spawnInFlight();

    backendExit()({ reason: { kind: "exited", code: 1 } });
    resolveSpawn();
    await spawnPromise;

    expect(pty.isLive).toBe(false);
  });

  it("stops telling a listener once it is disposed", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
    const listener = vi.fn();
    pty.onExit(listener).dispose();

    backendExit()({ reason: { kind: "exited", code: 0 } });

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
    await expect(spawnPromise).rejects.toThrow("closed while it opened");

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

  describe("a shell that already runs", () => {
    /** The listener `Pty` registered for the shell being taken over. */
    function takenOverListener(): (by?: string) => void {
      return vi.mocked(transport.onTakenOver).mock.calls[0][1] as (by?: string) => void;
    }

    /** The listener `Pty` registered for the shell being handed back. */
    function handedBackListener(): () => void {
      return vi.mocked(transport.onHandedBack).mock.calls[0][1] as () => void;
    }

    it("is attached to through the transport instead of started", async () => {
      await pty.attach(terminalId, noopListener);

      expect(transport.attach).toHaveBeenCalledWith(
        { terminalId, host: undefined },
        expect.objectContaining({ onChunk: expect.any(Function) }),
      );
      expect(transport.spawn).not.toHaveBeenCalled();
      // From here it is a shell like any other.
      pty.resize({ cols: 100, rows: 30 });
      expect(transport.resize).toHaveBeenCalledWith(terminalId, { cols: 100, rows: 30 });
    });

    it("names the host it runs on when it attaches, and never starts a shell there", async () => {
      const remote = ptyWith({ host: "office" });

      await remote.attach(terminalId, noopListener);
      expect(transport.attach).toHaveBeenCalledWith(
        { terminalId, host: "office" },
        expect.anything(),
      );

      await expect(remote.spawn(terminalId, shellConfig, dimensions, noopListener)).rejects.toThrow(
        "never started",
      );
      expect(transport.spawn).not.toHaveBeenCalled();
    });

    it("says whether a shell started here goes on without Cogno", async () => {
      const kept = ptyWith({ lifetime: "survivesClient" });

      await kept.spawn(terminalId, shellConfig, dimensions, noopListener);

      expect(transport.spawn).toHaveBeenCalledWith(
        expect.objectContaining({ lifetime: "survivesClient" }),
        expect.anything(),
      );
    });

    it("sends nothing to a shell another Cogno took over", async () => {
      await pty.attach(terminalId, noopListener);
      takenOverListener()();

      pty.write("ls\r");
      pty.executeLineEditorAction("clearLine");

      expect(transport.write).not.toHaveBeenCalled();
      expect(transport.executeLineEditorAction).not.toHaveBeenCalled();
    });

    it("tells its listeners when another Cogno takes it over", async () => {
      const takenOver = vi.fn();
      pty.onTakenOver(takenOver);
      await pty.attach(terminalId, noopListener);

      takenOverListener()("laptop");

      expect(takenOver).toHaveBeenCalledExactlyOnceWith("laptop");
      expect(pty.isLive).toBe(false);
    });

    it("tells a listener that subscribes later that it was taken over meanwhile", async () => {
      let attached!: () => void;
      vi.mocked(transport.attach).mockImplementationOnce(() => ({
        ready: new Promise(
          (resolve) => (attached = () => resolve(TauriMockFactory.createSessionInfo())),
        ),
        channel: 1,
        closeOutput: vi.fn(),
      }));
      const attaching = pty.attach(terminalId, noopListener);
      await vi.waitFor(() => expect(transport.attach).toHaveBeenCalled());

      // The takeover crosses the attach.
      takenOverListener()("laptop");
      attached();
      await attaching;
      const takenOver = vi.fn();
      pty.onTakenOver(takenOver);

      expect(pty.isLive).toBe(false);
      expect(takenOver).toHaveBeenCalledExactlyOnceWith("laptop");
    });

    it("tells its listeners when the Cogno that took it over let it go", async () => {
      const handedBack = vi.fn();
      pty.onHandedBack(handedBack);
      await pty.attach(terminalId, noopListener);
      takenOverListener()();

      handedBackListener()();

      expect(handedBack).toHaveBeenCalledOnce();
      // So is one that comes later.
      const later = vi.fn();
      pty.onHandedBack(later);
      expect(later).toHaveBeenCalledOnce();
    });

    it("is let go, not ended, when it runs on another machine", async () => {
      const remote = ptyWith({ host: "office" });
      await remote.attach(terminalId, noopListener);

      remote.dispose();

      // It belongs to the Cogno there: closing the tab here ends nothing.
      expect(transport.detach).toHaveBeenCalledWith(terminalId);
      expect(transport.kill).not.toHaveBeenCalled();
    });

    it("is let go as well when its terminal closed while it was still attaching", async () => {
      let attached!: () => void;
      vi.mocked(transport.attach).mockImplementationOnce(() => ({
        ready: new Promise(
          (resolve) => (attached = () => resolve(TauriMockFactory.createSessionInfo())),
        ),
        channel: 1,
        closeOutput: vi.fn(),
      }));
      const remote = ptyWith({ host: "office" });
      const attaching = remote.attach(terminalId, noopListener);
      await vi.waitFor(() => expect(transport.attach).toHaveBeenCalled());

      remote.dispose();
      attached();
      await attaching;

      expect(transport.detach).toHaveBeenCalledWith(terminalId);
      expect(transport.kill).not.toHaveBeenCalled();
    });

    it("is not killed on dispose once another Cogno has taken it over", async () => {
      await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
      const handle = vi.mocked(transport.spawn).mock.results[0].value;

      takenOverListener()();
      pty.dispose();

      // It runs on, shown elsewhere: nothing of it is this Cogno's to end.
      expect(transport.kill).not.toHaveBeenCalled();
      expect(handle.closeOutput).toHaveBeenCalled();
    });

    it("ends a shell of this machine that was handed back when its terminal goes for good", async () => {
      await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
      takenOverListener()();
      handedBackListener()();

      pty.dispose();

      // Nobody shows it any more, and its terminal is gone: it must not run on unseen.
      expect(transport.kill).toHaveBeenCalledWith(terminalId);
    });

    it("leaves the shell running when released to another session of its terminal", async () => {
      await pty.spawn(terminalId, shellConfig, dimensions, noopListener);
      const handle = vi.mocked(transport.spawn).mock.results[0].value;

      pty.release();

      expect(transport.kill).not.toHaveBeenCalled();
      expect(transport.detach).not.toHaveBeenCalled();
      expect(handle.closeOutput).toHaveBeenCalled();
    });
  });
});
