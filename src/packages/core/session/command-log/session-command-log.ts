import { Injectable } from "@angular/core";
import type { CommandLogReader, CommandLogWriter } from "@cogno/core/command-log/command-log.api";
import {
  CommandHistoryRow,
  CommandLogRepository,
  DirectoryHistoryRow,
  RecentCommandRow,
} from "@cogno/core/command-log/command-log.repository";
import { CommandPattern } from "@cogno/core/command-log/command-pattern.models";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { DatabaseAccess } from "@cogno/platform";
import { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { BehaviorSubject, EMPTY, from, Subject } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";

type WriteAction = (writer: CommandLogWriter) => Promise<void>;

const TRANSITION_RETENTION_WINDOW_MS = 30 * 60 * 1000;

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
  private readonly repository$ = new BehaviorSubject<CommandLogRepository | null>(null);
  private readonly writes$ = new Subject<WriteAction>();
  private groupId?: string;
  private recentExecution?: { command: string; timestamp: number };

  constructor(private readonly databaseAccess?: DatabaseAccess) {
    this.writes$
      .pipe(
        concatMap((action) =>
          this.repository$.pipe(
            filter((repository): repository is CommandLogRepository => repository !== null),
            take(1),
            concatMap((repository) => from(action(repository))),
            catchError((error) => {
              ErrorReporter.reportException({
                error,
                handled: true,
                source: "SessionCommandLog",
                context: { operation: "write" },
              });
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

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
      ErrorReporter.reportWarning({
        message: "No database access available; command history is disabled for this terminal.",
        source: "SessionCommandLog",
      });
      return Promise.resolve(null);
    }

    return CommandLogRepository.createForContext(this.databaseAccess, shellContext, adapter)
      .then((repository) => {
        this.repository$.next(repository);
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

  /** Queues a write. Returns immediately; failures are reported, not thrown. */
  write(action: WriteAction): void {
    this.writes$.next(action);
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

  private async read<T>(query: (reader: CommandLogReader) => Promise<T>, empty: T): Promise<T> {
    const repository = this.repository$.value;
    if (!repository) return empty;
    return query(repository);
  }
}
