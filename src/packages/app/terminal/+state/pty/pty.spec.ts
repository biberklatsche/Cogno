import { TauriPty } from "@cogno/app-tauri/pty";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellConfig } from "../../../config/+models/config";
import { Pty } from "./pty";

vi.mock("@cogno/app-tauri/pty", async (_importOriginal) => {
  const { TauriMockFactory } = await import("../../../../__test__/mocks/tauri-mock.factory");
  return {
    TauriPty: TauriMockFactory.createTauriPty(),
  };
});

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

describe("Pty", () => {
  let pty: Pty;
  const terminalId = "test-terminal";
  const shellConfig: ShellConfig = { shell_type: "Bash" } as any;
  const dimensions = { cols: 80, rows: 24 };

  beforeEach(() => {
    pty = new Pty();
    vi.clearAllMocks();
  });

  function spawnedChannel() {
    return vi.mocked(TauriPty.createDataChannel).mock.results[0].value;
  }

  function bytes(text: string): ArrayBuffer {
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
  }

  it("should spawn pty with a data channel created before the invoke", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    expect(TauriPty.createDataChannel).toHaveBeenCalledOnce();
    expect(TauriPty.spawn).toHaveBeenCalledWith(
      terminalId,
      shellConfig,
      dimensions,
      spawnedChannel(),
    );
  });

  it("should throw error if resize is called before spawn", () => {
    expect(() => pty.resize(dimensions)).toThrow("Please spawn Pty before resize.");
  });

  it("should resize pty if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.resize({ cols: 100, rows: 30 });
    expect(TauriPty.resize).toHaveBeenCalledWith(terminalId, 100, 30);
  });

  it("should ignore invalid resize dimensions", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.resize({ cols: null, rows: null } as any);
    expect(TauriPty.resize).not.toHaveBeenCalled();
  });

  it("should buffer resize until spawn is finished", async () => {
    let resolveSpawn!: () => void;
    vi.mocked(TauriPty.spawn).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSpawn = resolve;
        }),
    );

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions);
    pty.resize({ cols: 120, rows: 40 });
    expect(TauriPty.resize).not.toHaveBeenCalled();

    resolveSpawn();
    await spawnPromise;

    expect(TauriPty.resize).toHaveBeenCalledWith(terminalId, 120, 40);
  });

  it("should discard invalid buffered resize dimensions", async () => {
    let resolveSpawn!: () => void;
    vi.mocked(TauriPty.spawn).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSpawn = resolve;
        }),
    );

    const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions);
    pty.resize({ cols: null, rows: null } as any);

    resolveSpawn();
    await spawnPromise;

    expect(TauriPty.resize).not.toHaveBeenCalled();
  });

  it("should write to pty if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.write("ls\n");
    expect(TauriPty.write).toHaveBeenCalledWith(terminalId, "ls\n");
  });

  it("should execute shell action if spawned", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.executeLineEditorAction("clearLine", { start: 0 });
    expect(TauriPty.executeLineEditorAction).toHaveBeenCalledWith(terminalId, "clearLine", {
      start: 0,
    });
  });

  it("should deliver channel messages to the data listener as bytes", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    const listener = vi.fn();
    pty.onData(listener);

    spawnedChannel().onmessage(bytes("hello"));

    expect(listener).toHaveBeenCalledOnce();
    const chunk = listener.mock.calls[0][0] as Uint8Array;
    expect(chunk).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(chunk)).toBe("hello");
  });

  it("should replay chunks that arrived before the listener, in order", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    spawnedChannel().onmessage(bytes("first"));
    spawnedChannel().onmessage(bytes("second"));

    const listener = vi.fn();
    pty.onData(listener);
    spawnedChannel().onmessage(bytes("third"));

    const received = listener.mock.calls.map(([chunk]) => new TextDecoder().decode(chunk));
    expect(received).toEqual(["first", "second", "third"]);
  });

  it("should stop delivering data after the listener is disposed", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    const listener = vi.fn();
    const disposable = pty.onData(listener);
    disposable.dispose();

    spawnedChannel().onmessage(bytes("late"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("should forward acks to the backend", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.ack(4096);
    expect(TauriPty.ack).toHaveBeenCalledWith(terminalId, 4096);
  });

  it("should not send empty acks", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.ack(0);
    expect(TauriPty.ack).not.toHaveBeenCalled();
  });

  it("should listen to exit", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    const listener = vi.fn();
    const disposable = pty.onExit(listener);

    expect(TauriPty.onExit).toHaveBeenCalledWith(terminalId, listener);
    disposable.dispose();
  });

  it("should kill pty on dispose", async () => {
    await pty.spawn(terminalId, shellConfig, dimensions);
    pty.dispose();
    expect(TauriPty.kill).toHaveBeenCalledWith(terminalId);
  });
});
