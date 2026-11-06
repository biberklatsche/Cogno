import { TerminalId } from "@cogno/shared/domain";

/** A process running under a terminal's shell. */
export type TerminalProcess = {
  readonly terminalId: TerminalId;
  /** The executable's name, as the OS reports it (`codex`, `codex.exe`). */
  readonly name: string;
  readonly cwd?: string;
  /** Unix seconds. */
  readonly startedAt: number;
};

/**
 * The processes of every terminal in one pass. A feature that watches
 * something running in the terminals - a coding agent whose hooks no longer
 * carry the terminal (ARCHITECTURE.md 3.2) - finds which terminal runs it here.
 */
export abstract class TerminalProcessesPort {
  abstract snapshot(): Promise<ReadonlyArray<TerminalProcess>>;
}
