import { Injectable } from "@angular/core";
import type {
  CommandHistoryRow,
  CommandLogReader,
  CommandLogWriter,
  DirectoryHistoryRow,
  RecentCommandRow,
} from "@cogno/core/command-log/command-log.api";
import { CommandLogHealthTracker } from "@cogno/core/command-log/command-log.health";
import { CommandLogRepository } from "@cogno/core/command-log/command-log.repository";
import { CommandPattern } from "@cogno/core/command-log/command-pattern.models";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { DatabaseAccess } from "@cogno/platform";
import { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";

type WriteAction = (writer: CommandLogWriter) => Promise<void>;

const TRANSITION_RETENTION_WINDOW_MS = 30 * 60 * 1000;

/** How many queued writes are held before the oldest is thrown away. */
export const DEFAULT_MAX_PENDING_WRITES = 256;

/**
 * One session's access to the command log.
 *
 * The repository belongs to a shell context, so it is created per session and
 * lives here. Writes are queued and fire-and-forget: recording must never slow
 * the session down, and a failed write must not surface as a broken command.
 * Reads answer from whatever is there - before the repository exists they
 * return empty, which is the documented degradation when the database is
 * missing (ARCHITECTURE.md 4).
 *
 * Recording and querying stay apart through the two interfaces of the command
 * log: `CommandRecorder` only ever receives `CommandLogWriter`.
 */
@Injectable()
export class SessionCommandLog {
  private repository: CommandLogRepository | null = null;
  private readonly health = new CommandLogHealthTracker();
  private readonly queue: WriteAction[] = [];
  private draining = false;
  private disabled = false;
  private reportedUnhealthy = false;
  private reportedReadFailure = false;
  private groupId?: string;
  private recentExecution?: { command: string; timestamp: number };

  constructor(private readonly databaseAccess?: DatabaseAccess) {}

  get sessionGroupId(): string | undefined {
    return this.groupId;
  }

  /** Opens the log for this session's shell context. */
  open(
    shellContext: ResolvedShellContextContract,
    adapter: IPathAdapter,
    groupId?: string,
  ): Promise<CommandLogRepository | null> {
    this.groupId = groupId;
    if (!this.databaseAccess) {
      this.disabled = true;
      ErrorReporter.reportWarning({
        message: "No database access available; command history is disabled for this terminal.",
        source: "SessionCommandLog",
      });
      return Promise.resolve(null);
    }

    return CommandLogRepository.createForContext(this.databaseAccess, shellContext, adapter)
      .then((repository) => {
        this.repository = repository;
        void this.drain();
        return repository;
      })
      .catch((error) => {
        ErrorReporter.reportException({
          error,
          handled: true,
          source: "SessionCommandLog",
          context: { operation: "open" },
        });
        return null;
      });
  }

  /**
   * Queues a write. Returns immediately; a failure is reported, never thrown,
   * and a full queue loses its oldest entry rather than the session's speed.
   */
  write(action: WriteAction): void {
    if (this.disabled) return;

    if (this.queue.length >= DEFAULT_MAX_PENDING_WRITES) {
      // The newest command is the most valuable one to keep.
      this.queue.shift();
      this.health.recordOverflow();
    }
    this.queue.push(action);
    void this.drain();
  }

  /**
   * Writes once and awaits it - for shutdown-time records (an aborted command on
   * quit) that must reach the database before the process exits, unlike the
   * fire-and-forget queue. A missing repository or a failure is swallowed.
   */
  async writeAndAwait(action: WriteAction): Promise<void> {
    const repository = this.repository;
    if (this.disabled || !repository) return;
    try {
      await action(repository);
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "SessionCommandLog",
        context: { operation: "writeAndAwait" },
      });
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const repository = this.repository;
        if (!repository) return; // opens later; the queue waits, bounded.

        const backoffMs = this.health.backoffMs;
        if (backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }

        const action = this.queue.shift();
        if (!action) return;
        await this.runOnce(action, repository);
      }
    } finally {
      this.draining = false;
    }
  }

  /** Runs a write, retries it once, and gives up loudly rather than silently. */
  private async runOnce(action: WriteAction, repository: CommandLogRepository): Promise<void> {
    try {
      await action(repository);
      this.health.recordSuccess();
      this.reportedUnhealthy = false;
      return;
    } catch {
      // one retry - a busy database is the common case
    }
    try {
      await action(repository);
      this.health.recordSuccess();
      this.reportedUnhealthy = false;
    } catch (error) {
      this.health.recordFailure();
      ErrorReporter.reportException({
        error,
        handled: true,
        notify: !this.reportedUnhealthy,
        source: "SessionCommandLog",
        context: { operation: "write", dropped: String(this.health.dropped) },
      });
      this.reportedUnhealthy = true;
    }
  }

  /**
   * The command executed just before the current one, as long as it is recent
   * enough to count as a transition. Set by the recorder, read by the queries.
   */
  recordExecutionForTransition(command: string, timestamp: number): void {
    this.recentExecution = { command, timestamp };
  }

  transitionSourceCommand(): string | undefined {
    const recent = this.recentExecution;
    if (!recent) return undefined;
    if (Date.now() - recent.timestamp > TRANSITION_RETENTION_WINDOW_MS) {
      this.recentExecution = undefined;
      return undefined;
    }
    return recent.command;
  }

  // --- queries -----------------------------------------------------------

  async searchDirectories(fragment: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
    return this.read((reader) => reader.searchDirectories(fragment, limit), []);
  }

  async searchCommands(
    fragment: string,
    cwdRaw: string,
    limit: number = 50,
  ): Promise<CommandHistoryRow[]> {
    return this.read(
      (reader) => reader.searchCommands(fragment, cwdRaw, this.transitionSourceCommand(), limit),
      [],
    );
  }

  async getRecentCommands(options: {
    scope: "global" | "cwd" | "session";
    cwdRaw?: string;
    limit?: number;
  }): Promise<RecentCommandRow[]> {
    return this.read(
      (reader) => reader.getRecentCommands({ ...options, groupId: this.groupId }),
      [],
    );
  }

  async searchCommandPatterns(fragment: string, limit: number = 50): Promise<CommandPattern[]> {
    return this.read((reader) => reader.searchCommandPatterns(fragment, limit), []);
  }

  /** Whether any command is recorded. Without an open log: yes, so nothing is imported. */
  async hasAnyCommands(): Promise<boolean> {
    return this.read((reader) => reader.hasAnyCommands(), true);
  }

  // --- feedback (a write with a different sender) ------------------------

  markDirectorySelected(pathRaw: string): void {
    if (!pathRaw?.trim()) return;
    this.write((writer) => writer.markDirectorySelected(pathRaw));
  }

  markCommandSelected(commandRaw: string, cwdRaw: string): void {
    if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
    this.write((writer) => writer.markCommandSelected(commandRaw, cwdRaw));
  }

  markCommandPatternSelected(signatureKey: string): void {
    if (!signatureKey?.trim()) return;
    this.write((writer) => writer.markCommandPatternSelected(signatureKey));
  }

  confirmLivePattern(originalCommands: string[]): void {
    if (originalCommands.length === 0) return;
    this.write((writer) => writer.confirmLivePattern(originalCommands));
  }

  deleteCommandExecution(commandRaw: string, cwdRaw: string): void {
    if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
    this.write((writer) => writer.deleteCommandExecution(commandRaw, cwdRaw));
  }

  /**
   * A failed read answers empty, like a missing log. Autocomplete reads on every
   * keystroke, so a failing database is reported once, not once per key.
   */
  private async read<T>(query: (reader: CommandLogReader) => Promise<T>, empty: T): Promise<T> {
    const repository = this.repository;
    if (!repository) return empty;
    try {
      const result = await query(repository);
      this.reportedReadFailure = false;
      return result;
    } catch (error) {
      if (!this.reportedReadFailure) {
        this.reportedReadFailure = true;
        ErrorReporter.reportException({
          error,
          handled: true,
          source: "SessionCommandLog",
          context: { operation: "read" },
        });
      }
      return empty;
    }
  }
}
