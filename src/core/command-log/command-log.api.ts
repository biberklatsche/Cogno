import { CommandPattern } from "./command-pattern.models";

/** The rows the command log hands out and takes in; part of its contract. */
export type DirectoryHistoryRow = {
  path: string;
  basename: string;
  visitCount: number;
  selectCount: number;
  lastVisitAt: number;
  lastSelectAt: number;
};
export type RecentCommandRow = {
  command: string;
  executedAt: number;
  isCurrentSession?: number;
  isCurrentCwd?: number;
};
export type CommandHistoryRow = {
  command: string;
  execCount: number;
  selectCount: number;
  lastExecAt: number;
  lastSelectAt: number;
  cwdExecCount: number;
  cwdSelectCount: number;
  cwdLastExecAt: number;
  cwdLastSelectAt: number;
  transitionCount: number;
  outgoingTransitionCount: number;
  lastTransitionAt: number;
};
export type CommandExecutionDetails = {
  durationMs?: number;
  returnCode?: number;
};

/**
 * The two sides of the command log (ARCHITECTURE.md 2.4).
 *
 * Recording and using the data are separate jobs, so they are separate
 * interfaces even though one repository implements both: whoever writes
 * cannot read, and whoever reads cannot write. That is a compile error, not
 * a convention.
 */

/** Turns what the shell reported into rows. Never reads. */
export interface CommandLogWriter {
  upsertWorkingDirectory(cwdRaw: string): Promise<void>;
  upsertCommandExecution(
    commandRaw: string,
    cwdRaw: string,
    groupId?: string,
    maxEntries?: number,
    details?: CommandExecutionDetails,
  ): Promise<void>;
  upsertCommandTransition(previousCommandRaw: string, nextCommandRaw: string): Promise<void>;
  deleteCommandExecution(commandRaw: string, cwdRaw: string): Promise<void>;
  bulkImportCommands(
    entries: { command: string; timestamp: number }[],
    cwdRaw: string,
  ): Promise<void>;

  /**
   * Feedback is recording too - what the user picked is a fact about their
   * behaviour, only with a different sender than the shell.
   */
  markCommandSelected(commandRaw: string, cwdRaw: string): Promise<void>;
  markDirectorySelected(pathRaw: string): Promise<void>;
  markCommandPatternSelected(signatureKeyRaw: string): Promise<void>;
  confirmLivePattern(originalCommands: string[]): Promise<void>;
}

/** Answers questions about what was executed. Never writes. */
export interface CommandLogReader {
  getRecentCommands(options: {
    scope: "global" | "cwd" | "session";
    cwdRaw?: string;
    groupId?: string;
    limit?: number;
  }): Promise<RecentCommandRow[]>;
  searchCommands(
    fragmentRaw: string,
    cwdRaw: string,
    previousCommandRaw?: string,
    limit?: number,
  ): Promise<CommandHistoryRow[]>;
  searchDirectories(fragmentRaw: string, limit?: number): Promise<DirectoryHistoryRow[]>;
  searchCommandPatterns(fragmentRaw: string, limit?: number): Promise<CommandPattern[]>;
  hasAnyCommands(): Promise<boolean>;
}
