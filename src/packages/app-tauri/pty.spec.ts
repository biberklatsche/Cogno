import type { PtyChunkContract, PtyOutputListenerContract } from "@cogno/core-api";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PTY_CHUNK_GAP_TIMEOUT_MS, PtyDataChannel, TauriPtyTransport } from "./pty";

type RawMessage = { message: ArrayBuffer; index: number } | { end: true; index: number };

const registry = vi.hoisted(() => ({
  callbacks: new Map<number, (message: unknown) => void>(),
  nextId: 1,
}));

vi.mock("@tauri-apps/api/core", () => ({
  SERIALIZE_TO_IPC_FN: "__TAURI_TO_IPC_KEY__",
  invoke: vi.fn(),
  transformCallback: (callback: (message: unknown) => void) => {
    const id = registry.nextId++;
    registry.callbacks.set(id, callback);
    return id;
  },
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

/** Frames a chunk the way the Rust reader thread does: u32 LE seq + payload. */
function frame(seq: number, text: string): ArrayBuffer {
  const payload = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(4 + payload.byteLength);
  new DataView(buffer).setUint32(0, seq, true);
  new Uint8Array(buffer, 4).set(payload);
  return buffer;
}

describe("PtyDataChannel", () => {
  const unregisterCallback = vi.fn();
  let channel: PtyDataChannel;
  let received: PtyChunkContract[];
  let gaps: [number, number][];

  function deliver(message: RawMessage) {
    registry.callbacks.get(channel.id)!(message);
  }

  function texts(): string[] {
    return received.map((chunk) => new TextDecoder().decode(chunk.data));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    (window as any).__TAURI_INTERNALS__ = { unregisterCallback };
    unregisterCallback.mockClear();
    received = [];
    gaps = [];
    channel = new PtyDataChannel();
    channel.onmessage = (chunk) => received.push(chunk);
    channel.onGap = (from, to) => gaps.push([from, to]);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).__TAURI_INTERNALS__;
  });

  it("should serialize as a tauri channel reference", () => {
    expect(JSON.stringify({ onData: channel })).toBe(`{"onData":"__CHANNEL__:${channel.id}"}`);
  });

  it("should deliver chunks in sequence order with the header stripped", () => {
    deliver({ message: frame(0, "a"), index: 0 });
    deliver({ message: frame(1, "b"), index: 1 });
    expect(texts()).toEqual(["a", "b"]);
    expect(received.map((chunk) => chunk.seq)).toEqual([0, 1]);
  });

  it("should hold back chunks that arrive ahead of a missing one", () => {
    deliver({ message: frame(1, "b"), index: 1 });
    deliver({ message: frame(2, "c"), index: 2 });
    expect(texts()).toEqual([]);

    deliver({ message: frame(0, "a"), index: 0 });
    expect(texts()).toEqual(["a", "b", "c"]);
    expect(gaps).toEqual([]);
  });

  it("should give up a chunk that stays missing and continue after the gap", () => {
    deliver({ message: frame(0, "a"), index: 0 });
    deliver({ message: frame(2, "c"), index: 2 });
    deliver({ message: frame(3, "d"), index: 3 });
    vi.advanceTimersByTime(PTY_CHUNK_GAP_TIMEOUT_MS - 1);
    expect(texts()).toEqual(["a"]);

    vi.advanceTimersByTime(1);
    expect(texts()).toEqual(["a", "c", "d"]);
    expect(gaps).toEqual([[1, 2]]);

    // The lost chunk turning up late is ignored; the stream goes on.
    deliver({ message: frame(1, "b"), index: 1 });
    deliver({ message: frame(4, "e"), index: 4 });
    expect(texts()).toEqual(["a", "c", "d", "e"]);
  });

  it("should not start the gap timer while nothing is pending", () => {
    deliver({ message: frame(0, "a"), index: 0 });
    vi.advanceTimersByTime(PTY_CHUNK_GAP_TIMEOUT_MS * 2);
    expect(gaps).toEqual([]);
  });

  it("should stop delivering and unregister the callback on close", () => {
    channel.close();
    expect(unregisterCallback).toHaveBeenCalledWith(channel.id);

    deliver({ message: frame(0, "a"), index: 0 });
    expect(texts()).toEqual([]);

    channel.close(); // idempotent
    expect(unregisterCallback).toHaveBeenCalledOnce();
  });

  it("should close itself when the backend ends the channel", () => {
    deliver({ end: true, index: 0 });
    expect(unregisterCallback).toHaveBeenCalledWith(channel.id);
  });

  it("should drop pending chunks and the gap timer on close", () => {
    deliver({ message: frame(1, "b"), index: 1 });
    channel.close();
    vi.advanceTimersByTime(PTY_CHUNK_GAP_TIMEOUT_MS * 2);
    expect(gaps).toEqual([]);
    expect(texts()).toEqual([]);
  });
});

describe("TauriPtyTransport", () => {
  const unregisterCallback = vi.fn();
  let transport: TauriPtyTransport;
  let output: PtyOutputListenerContract;

  beforeEach(() => {
    (window as any).__TAURI_INTERNALS__ = { unregisterCallback };
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue({ shellProcessId: 4711 });
    transport = new TauriPtyTransport();
    output = { onChunk: vi.fn(), onChunksLost: vi.fn() };
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
  });

  function spawn() {
    return transport.spawn(
      {
        terminalId: "t1",
        cols: 80,
        rows: 24,
        profile: {
          shell_type: "Bash",
          inject_cogno_cli: true,
          enable_shell_integration: true,
          load_user_rc: true,
        },
        devMode: true,
      },
      output,
    );
  }

  it("should invoke pty_spawn with the backend option names and a channel wired to the listener", async () => {
    const handle = spawn();
    const [command, args] = vi.mocked(invoke).mock.calls[0] as [string, any];
    expect(command).toBe("pty_spawn");
    expect(args.options).toEqual({
      name: "t1",
      cols: 80,
      rows: 24,
      profile: expect.objectContaining({ shell_type: "Bash" }),
      dev_mode: true,
    });
    const channel: PtyDataChannel = args.onData;
    registry.callbacks.get(channel.id)!({ message: frame(0, "hi"), index: 0 });
    expect(output.onChunk).toHaveBeenCalledWith(expect.objectContaining({ seq: 0 }));

    await expect(handle.ready).resolves.toEqual({ shellProcessId: 4711 });
  });

  it("should close the channel through the spawn handle", () => {
    const handle = spawn();
    const channel: PtyDataChannel = (vi.mocked(invoke).mock.calls[0] as any)[1].onData;
    handle.closeOutput();
    expect(unregisterCallback).toHaveBeenCalledWith(channel.id);
  });

  it("should map the remaining commands one to one", async () => {
    await transport.ack("t1", 7);
    await transport.write("t1", "ls");
    await transport.resize("t1", 100, 30);
    await transport.kill("t1");
    await transport.executeLineEditorAction("t1", "clearLine", { start: 0 });
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ["pty_ack", { terminalId: "t1", seq: 7 }],
      ["pty_write", { terminalId: "t1", data: "ls" }],
      ["pty_resize", { terminalId: "t1", cols: 100, rows: 30 }],
      ["pty_kill", { terminalId: "t1" }],
      [
        "pty_execute_line_editor_action",
        { terminalId: "t1", action: "clearLine", payloadJson: JSON.stringify({ start: 0 }) },
      ],
    ]);
  });
});
