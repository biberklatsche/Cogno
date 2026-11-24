import type { SessionInfoContract } from "@cogno/platform";
import { vi } from "vitest";

export class TauriMockFactory {
  /** Spawn handle returned by `createPtyTransport().spawn`; `ready` resolves immediately. */
  static createPtySpawnHandle() {
    return {
      ready: Promise.resolve({ shellProcessId: 1234 }),
      channel: 1,
      closeOutput: vi.fn(),
    };
  }

  /** A shell as its host describes it: a Bash that nobody shows. */
  static createSessionInfo(terminalId = "test-terminal"): SessionInfoContract {
    return {
      terminalId,
      placement: {},
      profile: {
        shell_type: "Bash",
        env: { COGNO_SESSION_TOKEN: "running-token" },
        inject_cogno_cli: false,
        enable_shell_integration: true,
        load_user_rc: true,
      },
      size: { cols: 80, rows: 24 },
      attached: { to: "nowhere" },
    };
  }

  /** Attach handle returned by `createPtyTransport().attach`; `ready` resolves immediately. */
  static createPtyAttachHandle(terminalId = "test-terminal") {
    return {
      ready: Promise.resolve(TauriMockFactory.createSessionInfo(terminalId)),
      channel: 1,
      closeOutput: vi.fn(),
    };
  }

  /** Fake `PtyTransport` (from `@cogno/platform`). */
  static createPtyTransport() {
    return {
      spawn: vi.fn(() => TauriMockFactory.createPtySpawnHandle()),
      attach: vi.fn(() => TauriMockFactory.createPtyAttachHandle()),
      onTakenOver: vi.fn().mockResolvedValue(() => {}),
      onHandedBack: vi.fn().mockResolvedValue(() => {}),
      place: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn().mockResolvedValue(undefined),
      paneClosed: vi.fn().mockResolvedValue(undefined),
      detach: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined),
      onExit: vi.fn().mockResolvedValue(() => {}),
      write: vi.fn().mockResolvedValue(undefined),
      executeLineEditorAction: vi.fn().mockResolvedValue(undefined),
    };
  }
}
