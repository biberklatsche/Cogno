import { vi } from "vitest";

export class TauriMockFactory {
  /** Spawn handle returned by `createPtyTransport().spawn`; `ready` resolves immediately. */
  static createPtySpawnHandle() {
    return {
      ready: Promise.resolve({ shellProcessId: 1234 }),
      closeOutput: vi.fn(),
    };
  }

  /** Fake `PtyTransport` (from `@cogno/platform`). */
  static createPtyTransport() {
    return {
      spawn: vi.fn(() => TauriMockFactory.createPtySpawnHandle()),
      attach: vi.fn(() => TauriMockFactory.createPtySpawnHandle()),
      onTakenOver: vi.fn().mockResolvedValue(() => {}),
      onReleased: vi.fn().mockResolvedValue(() => {}),
      ack: vi.fn().mockResolvedValue(undefined),
      kill: vi.fn().mockResolvedValue(undefined),
      detach: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined),
      onExit: vi.fn().mockResolvedValue(() => {}),
      write: vi.fn().mockResolvedValue(undefined),
      executeLineEditorAction: vi.fn().mockResolvedValue(undefined),
    };
  }
}
