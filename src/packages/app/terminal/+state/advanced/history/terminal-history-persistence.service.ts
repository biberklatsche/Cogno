import { Injectable } from "@angular/core";
import { ErrorReporter } from "@cogno/app/common/error/error-reporter";
import { Path } from "@cogno/app-tauri/path";
import { IPathAdapter } from "@cogno/core-api";
import { BehaviorSubject, EMPTY, from, Subject } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";
import { ConfigService } from "../../../../config/+state/config.service";
import { ShellContext } from "../model/models";
import { CommandPattern } from "./command-pattern.models";
import {
  CommandHistoryRow,
  DirectoryHistoryRow,
  HistoryRepository,
  RecentCommandRow,
} from "./history.repository";
import { ShellHistoryReader } from "./shell-history-reader";
import { ExecutedCommand } from "./terminal-command-history.store";

type PersistenceAction = (repo: HistoryRepository) => Promise<void>;
type ReturnCodePolicy = {
  defaultAllowedCodes: Set<number>;
  perCommandAllowedCodes: Map<string, Set<number>>;
};
type RecentCommandExecution = {
  command: string;
  timestamp: number;
};

const TRANSITION_RETENTION_WINDOW_MS = 30 * 60 * 1000;

function deduplicateByCommand(
  entries: { command: string; timestamp: number }[],
): { command: string; timestamp: number }[] {
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const existing = seen.get(entry.command);
    if (existing === undefined || entry.timestamp > existing) {
      seen.set(entry.command, entry.timestamp);
    }
  }
  return Array.from(seen.entries())
    .map(([command, timestamp]) => ({ command, timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function firstToken(commandRaw: string): string {
  const trimmed = commandRaw.trim();
  if (!trimmed) return "";
  const i = trimmed.search(/\s/);
  return (i === -1 ? trimmed : trimmed.slice(0, i)).toLowerCase();
}

@Injectable()
export class TerminalHistoryPersistenceService {
  private static _shellHistoryImportStarted = false;

  private readonly _repo$ = new BehaviorSubject<HistoryRepository | null>(null);
  private readonly _actions$ = new Subject<PersistenceAction>();
  private readonly _returnCodePolicy: ReturnCodePolicy = {
    defaultAllowedCodes: new Set([0]),
    perCommandAllowedCodes: new Map<string, Set<number>>(),
  };
  private _lastCwdRaw = "";
  private _recentCommandExecution?: RecentCommandExecution;
  private _groupId?: string;

  constructor(private readonly configService?: ConfigService) {
    this._actions$
      .pipe(
        concatMap((action) =>
          this._repo$.pipe(
            filter((r): r is HistoryRepository => r !== null),
            take(1),
            concatMap((repo) => from(action(repo))),
            catchError((err) => {
              ErrorReporter.reportException({
                error: err,
                handled: true,
                source: "TerminalHistoryPersistenceService",
                context: {
                  operation: "persistenceAction",
                },
              });
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  get groupId(): string | undefined {
    return this._groupId;
  }

  initialize(shellContext: ShellContext, adapter: IPathAdapter, groupId?: string): void {
    this._groupId = groupId;
    HistoryRepository.createForContext(shellContext, adapter)
      .then((repo) => {
        this._repo$.next(repo);
        if (
          this.configService?.config.terminal?.history?.import_shell_history &&
          !TerminalHistoryPersistenceService._shellHistoryImportStarted
        ) {
          TerminalHistoryPersistenceService._shellHistoryImportStarted = true;
          this.enqueue((r) => this.importShellHistoryIfEmpty(r, shellContext));
        }
      })
      .catch((error) =>
        ErrorReporter.reportException({
          error,
          handled: true,
          source: "TerminalHistoryPersistenceService",
          context: {
            operation: "initialize",
          },
        }),
      );
  }

  private async importShellHistoryIfEmpty(
    repo: HistoryRepository,
    shellContext: ShellContext,
  ): Promise<void> {
    const hasCommands = await repo.hasAnyCommands();
    if (hasCommands) return;

    try {
      const homeDir = await Path.homeDir();
      const entries = await ShellHistoryReader.read(
        shellContext.shellType,
        shellContext.backendOs,
        homeDir,
      );
      if (entries.length === 0) return;

      const historyConfig = this.configService?.config.terminal?.history;
      const maxEntries = historyConfig?.max_entries;

      const deduplicated = deduplicateByCommand(entries);
      const limited = maxEntries && maxEntries > 0 ? deduplicated.slice(-maxEntries) : deduplicated;

      await repo.bulkImportCommands(limited, homeDir);
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "TerminalHistoryPersistenceService",
        context: { operation: "importShellHistory", shellType: shellContext.shellType },
      });
    }
  }

  onCwdChanged(cwdRaw: string): void {
    if (!cwdRaw?.trim()) return;
    const cwd = cwdRaw.trim();
    if (cwd === this._lastCwdRaw) return;
    this._lastCwdRaw = cwd;
    this.enqueue((repo) => repo.upsertWorkingDirectory(cwdRaw));
  }

  onCommandExecuted(executedCommand: ExecutedCommand | undefined): void {
    if (!this.shouldPersistCommand(executedCommand)) return;
    if (!executedCommand) return;

    const persistedCommand = executedCommand.command.trim();
    const timestamp = Date.now();
    const recentPreviousCommand = this.getRecentTransitionSourceCommand();

    const maxEntries = this.configService?.config.terminal?.history?.max_entries;

    this.enqueue(async (repo) => {
      await repo.upsertCommandExecution(
        persistedCommand,
        executedCommand.directory,
        this._groupId,
        maxEntries,
      );

      if (recentPreviousCommand) {
        await repo.upsertCommandTransition(recentPreviousCommand, persistedCommand);
      }
    });

    this._recentCommandExecution = {
      command: persistedCommand,
      timestamp,
    };
  }

  setDefaultAllowedReturnCodes(codes: number[]): void {
    this._returnCodePolicy.defaultAllowedCodes = new Set(codes);
  }

  setAllowedReturnCodesForCommand(commandToken: string, codes: number[]): void {
    const token = commandToken.trim().toLowerCase();
    if (!token) return;
    this._returnCodePolicy.perCommandAllowedCodes.set(token, new Set(codes));
  }

  setAllowedReturnCodeWhitelist(whitelist: Record<string, number[]>): void {
    this._returnCodePolicy.perCommandAllowedCodes.clear();
    for (const [token, codes] of Object.entries(whitelist)) {
      this.setAllowedReturnCodesForCommand(token, codes);
    }
  }

  deleteCommandExecution(commandRaw: string, cwdRaw: string): void {
    if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
    this.enqueue((repo) => repo.deleteCommandExecution(commandRaw, cwdRaw));
  }

  async searchDirectories(fragment: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
    const repo = this._repo$.value;
    if (!repo) return [];
    return repo.searchDirectories(fragment, limit);
  }

  async searchCommands(
    fragment: string,
    cwdRaw: string,
    limit: number = 50,
  ): Promise<CommandHistoryRow[]> {
    const repo = this._repo$.value;
    if (!repo) return [];
    return repo.searchCommands(fragment, cwdRaw, this.getRecentTransitionSourceCommand(), limit);
  }

  async getRecentCommands(options: {
    scope: "global" | "cwd" | "session";
    cwdRaw?: string;
    limit?: number;
  }): Promise<RecentCommandRow[]> {
    const repo = this._repo$.value;
    if (!repo) return [];
    return repo.getRecentCommands({ ...options, groupId: this._groupId });
  }

  async searchCommandPatterns(fragment: string, limit: number = 50): Promise<CommandPattern[]> {
    const repo = this._repo$.value;
    if (!repo) return [];
    return repo.searchCommandPatterns(fragment, limit);
  }

  markDirectorySelected(pathRaw: string): void {
    if (!pathRaw?.trim()) return;
    this.enqueue((repo) => repo.markDirectorySelected(pathRaw));
  }

  markCommandSelected(commandRaw: string, cwdRaw: string): void {
    if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
    this.enqueue((repo) => repo.markCommandSelected(commandRaw, cwdRaw));
  }

  confirmLivePattern(originalCommands: string[]): void {
    if (originalCommands.length === 0) return;
    this.enqueue((repo) => repo.confirmLivePattern(originalCommands));
  }

  markCommandPatternSelected(signatureKey: string): void {
    if (!signatureKey?.trim()) return;
    this.enqueue((repo) => repo.markCommandPatternSelected(signatureKey));
  }

  private shouldPersistCommand(executedCommand: ExecutedCommand | undefined): boolean {
    if (executedCommand === undefined) return false;
    if (executedCommand.command === undefined) return false;
    if (
      this.configService?.config.terminal?.history?.ignore_commands_with_leading_space &&
      executedCommand.command.startsWith(" ")
    ) {
      return false;
    }
    const command = executedCommand.command.trim();
    if (command.length === 0) return false;
    if (command === ":") return false;
    if (command === "true") return false;
    if (command === "false") return false;
    const token = firstToken(command);
    if (!token) return false;
    if (token === "cd") return false;
    if (executedCommand.commandExists === true) return true;
    if (executedCommand.commandExists === false) return false;
    if (executedCommand.returnCode === undefined || !Number.isFinite(executedCommand.returnCode))
      return false;

    const allowed =
      this._returnCodePolicy.perCommandAllowedCodes.get(token) ??
      this._returnCodePolicy.defaultAllowedCodes;
    return allowed.has(executedCommand.returnCode);
  }

  private enqueue(action: PersistenceAction): void {
    this._actions$.next(action);
  }

  private getRecentTransitionSourceCommand(): string | undefined {
    const recentCommandExecution = this._recentCommandExecution;
    if (!recentCommandExecution) {
      return undefined;
    }

    const ageInMilliseconds = Date.now() - recentCommandExecution.timestamp;
    if (ageInMilliseconds > TRANSITION_RETENTION_WINDOW_MS) {
      this._recentCommandExecution = undefined;
      return undefined;
    }

    return recentCommandExecution.command;
  }
}
