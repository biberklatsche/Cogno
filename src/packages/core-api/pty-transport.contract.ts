import { ShellTypeContract } from "./filesystem.contract";

/**
 * Shell profile as the backend's spawner expects it (wire format, hence the
 * snake_case keys). Structurally identical to the app's configured profile.
 */
export type PtyShellProfileContract = {
  shell_type: ShellTypeContract;
  path?: string;
  args?: string[];
  env?: Record<string, string>;
  use_conpty?: boolean;
  working_dir?: string;
  inject_cogno_cli: boolean;
  enable_shell_integration: boolean;
  load_user_rc: boolean;
};

export type PtySpawnOptionsContract = {
  terminalId: string;
  cols: number;
  rows: number;
  profile: PtyShellProfileContract;
  devMode: boolean;
};

export type PtySpawnResultContract = {
  shellProcessId: number | null;
};

/** One chunk of raw PTY output. `seq` numbers the chunks of a spawn from 0 up. */
export type PtyChunkContract = { seq: number; data: Uint8Array };

export type PtyExitEventContract = { exitCode: number; signal?: number };

export interface PtyOutputListenerContract {
  /** Chunks arrive strictly in sequence order. */
  onChunk(chunk: PtyChunkContract): void;
  /** Chunks `fromSeq` up to (excluding) `toSeq` were lost in transit and skipped. */
  onChunksLost(fromSeq: number, toSeq: number): void;
}

export interface PtySpawnHandleContract {
  /** Resolves once the shell runs, rejects when it could not be spawned. */
  readonly ready: Promise<PtySpawnResultContract>;
  /**
   * Stops output delivery for good. Safe to call before `ready` settles;
   * the backend session (if it comes into existence) still has to be killed.
   */
  closeOutput(): void;
}

/**
 * Transport to the backend's PTY sessions. Output is pushed through the
 * listener handed to `spawn` (wired before the shell starts, so no byte is
 * lost) and subject to flow control: the reader stops once too much output
 * is unacknowledged, so the consumer must `ack` chunks as it processes them.
 */
export abstract class PtyTransportPort {
  abstract spawn(
    options: PtySpawnOptionsContract,
    output: PtyOutputListenerContract,
  ): PtySpawnHandleContract;
  /** Flow control: every chunk up to and including `seq` has been processed. */
  abstract ack(terminalId: string, seq: number): Promise<void>;
  abstract write(terminalId: string, data: string): Promise<void>;
  abstract resize(terminalId: string, cols: number, rows: number): Promise<void>;
  abstract kill(terminalId: string): Promise<void>;
  abstract executeLineEditorAction(
    terminalId: string,
    action: string,
    payload?: object,
  ): Promise<void>;
  /** Resolves to the unlisten function. */
  abstract onExit(
    terminalId: string,
    listener: (event: PtyExitEventContract) => void,
  ): Promise<() => void>;
}
