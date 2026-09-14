import { Injectable } from "@angular/core";
import type { CommandLogWriter } from "@cogno/core/command-log/command-log.api";
import { ShellHistoryReader } from "@cogno/core/command-log/import/shell-history-reader";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Paths } from "@cogno/platform/path";
import { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { SessionCommandLog } from "../command-log/session-command-log";
import { ExecutedCommand } from "./executed-command";

type ReturnCodePolicy = {
  defaultAllowedCodes: Set<number>;
  perCommandAllowedCodes: Map<string, Set<number>>;
};

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

/**
 * Turns what the shell reported into rows: which command ran, where, how long
 * it took and how it ended (ARCHITECTURE.md 2.4).
 *
 * It writes and never reads - the only thing it receives is a
 * `CommandLogWriter`. It also knows nothing about who will use the data.
 */
@Injectable()
export class CommandRecorder {
  private static shellHistoryImportStarted = false;

  private readonly returnCodePolicy: ReturnCodePolicy = {
    defaultAllowedCodes: new Set([0]),
    perCommandAllowedCodes: new Map<string, Set<number>>(),
  };
  private lastCwdRaw = "";

  constructor(
    private readonly commandLog: SessionCommandLog,
    private readonly paths?: Paths,
    private readonly historyReader?: ShellHistoryReader,
    private readonly configService?: ConfigService,
  ) {}

  initialize(
    shellContext: ResolvedShellContextContract,
    adapter: IPathAdapter,
    groupId?: string,
  ): void {
    void this.commandLog.open(shellContext, adapter, groupId).then((repository) => {
      if (!repository) return;
      if (
        this.configService?.config.terminal?.history?.import_shell_history &&
        !CommandRecorder.shellHistoryImportStarted
      ) {
        CommandRecorder.shellHistoryImportStarted = true;
        this.commandLog.write((writer) => this.importShellHistoryIfEmpty(writer, shellContext));
      }
    });
  }

  onCwdChanged(cwdRaw: string): void {
    if (!cwdRaw?.trim()) return;
    const cwd = cwdRaw.trim();
    if (cwd === this.lastCwdRaw) return;
    this.lastCwdRaw = cwd;
    this.commandLog.write((writer) => writer.upsertWorkingDirectory(cwdRaw));
  }

  onCommandExecuted(executedCommand: ExecutedCommand | undefined): void {
    if (!this.shouldPersistCommand(executedCommand)) return;
    if (!executedCommand) return;

    const persistedCommand = executedCommand.command.trim();
    const timestamp = Date.now();
    const recentPreviousCommand = this.commandLog.transitionSourceCommand();
    const maxEntries = this.configService?.config.terminal?.history?.max_entries;
    const groupId = this.commandLog.sessionGroupId;

    this.commandLog.write(async (writer) => {
      await writer.upsertCommandExecution(
        persistedCommand,
        executedCommand.directory,
        groupId,
        maxEntries,
        { durationMs: executedCommand.duration, returnCode: executedCommand.returnCode },
      );

      if (recentPreviousCommand) {
        await writer.upsertCommandTransition(recentPreviousCommand, persistedCommand);
      }
    });

    this.commandLog.recordExecutionForTransition(persistedCommand, timestamp);
  }

  setDefaultAllowedReturnCodes(codes: number[]): void {
    this.returnCodePolicy.defaultAllowedCodes = new Set(codes);
  }

  setAllowedReturnCodesForCommand(commandToken: string, codes: number[]): void {
    const token = commandToken.trim().toLowerCase();
    if (!token) return;
    this.returnCodePolicy.perCommandAllowedCodes.set(token, new Set(codes));
  }

  setAllowedReturnCodeWhitelist(whitelist: Record<string, number[]>): void {
    this.returnCodePolicy.perCommandAllowedCodes.clear();
    for (const [token, codes] of Object.entries(whitelist)) {
      this.setAllowedReturnCodesForCommand(token, codes);
    }
  }

  private async importShellHistoryIfEmpty(
    writer: CommandLogWriter,
    shellContext: ResolvedShellContextContract,
  ): Promise<void> {
    try {
      if (!this.paths || !this.historyReader) return;
      const homeDir = await this.paths.homeDir();
      const entries = await this.historyReader.read(
        shellContext.shellType,
        shellContext.backendOs,
        homeDir,
      );
      if (entries.length === 0) return;

      const maxEntries = this.configService?.config.terminal?.history?.max_entries;
      const deduplicated = deduplicateByCommand(entries);
      const limited = maxEntries && maxEntries > 0 ? deduplicated.slice(-maxEntries) : deduplicated;

      await writer.bulkImportCommands(limited, homeDir);
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "CommandRecorder",
        context: { operation: "importShellHistory", shellType: shellContext.shellType },
      });
    }
  }

  /**
   * Record a command that was still running when the app quit as an aborted
   * entry: it never reported a return code, so `shouldPersistCommand` would drop
   * it, but it must not vanish from history (step 27b-2). Same text filters, no
   * return-code gate; awaited so it reaches the log before the process exits.
   */
  async recordAbortedCommand(executedCommand: ExecutedCommand): Promise<void> {
    if (!this.isRecordableCommandText(executedCommand)) return;

    const persistedCommand = executedCommand.command.trim();
    const groupId = this.commandLog.sessionGroupId;
    const maxEntries = this.configService?.config.terminal?.history?.max_entries;

    await this.commandLog.writeAndAwait((writer) =>
      writer.upsertCommandExecution(
        persistedCommand,
        executedCommand.directory,
        groupId,
        maxEntries,
        {
          durationMs: executedCommand.duration,
          returnCode: executedCommand.returnCode,
        },
      ),
    );
  }

  /** The command-text filters shared by normal and aborted recording. */
  private isRecordableCommandText(executedCommand: ExecutedCommand | undefined): boolean {
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
    return true;
  }

  private shouldPersistCommand(executedCommand: ExecutedCommand | undefined): boolean {
    if (!this.isRecordableCommandText(executedCommand) || executedCommand === undefined) {
      return false;
    }
    const command = executedCommand.command.trim();
    const token = firstToken(command);
    if (executedCommand.commandExists === true) return true;
    if (executedCommand.commandExists === false) return false;
    if (executedCommand.returnCode === undefined || !Number.isFinite(executedCommand.returnCode))
      return false;

    const allowed =
      this.returnCodePolicy.perCommandAllowedCodes.get(token) ??
      this.returnCodePolicy.defaultAllowedCodes;
    return allowed.has(executedCommand.returnCode);
  }
}
