import { Injectable } from "@angular/core";
import { resolveLimit, UNLIMITED } from "@cogno/core/api/contributions";
import type { CommandLogWriter } from "@cogno/core/command-log/command-log.api";
import { ShellHistoryReader } from "@cogno/core/command-log/import/shell-history-reader";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Paths } from "@cogno/platform/path";
import { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { SessionCommandLog } from "../command-log/session-command-log";
import { ExecutedCommand } from "./executed-command";

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

  private lastCwdRaw = "";

  constructor(
    private readonly commandLog: SessionCommandLog,
    private readonly paths: Paths,
    private readonly historyReader: ShellHistoryReader,
    private readonly configService: ConfigService,
  ) {}

  initialize(
    shellContext: ResolvedShellContextContract,
    adapter: IPathAdapter,
    groupId?: string,
  ): void {
    void this.commandLog.open(shellContext, adapter, groupId).then(async (repository) => {
      if (!repository) return;
      if (
        !this.configService.config.terminal?.history?.import_shell_history ||
        CommandRecorder.shellHistoryImportStarted
      ) {
        return;
      }
      CommandRecorder.shellHistoryImportStarted = true;
      // Only into an empty history: the import is a first-launch seed, not a sync.
      if (await this.commandLog.hasAnyCommands()) return;
      this.commandLog.write((writer) => this.importShellHistory(writer, shellContext));
    });
  }

  onCwdChanged(cwdRaw: string): void {
    if (!cwdRaw?.trim()) return;
    const cwd = cwdRaw.trim();
    if (cwd === this.lastCwdRaw) return;
    this.lastCwdRaw = cwd;
    this.commandLog.write((writer) => writer.upsertWorkingDirectory(cwdRaw));
  }

  /**
   * Every recordable command goes into the history, typos included - that is
   * where the user looks to fix them. Only a command worth suggesting is also
   * ranked and becomes a transition, so autocomplete never offers a typo.
   */
  onCommandExecuted(executedCommand: ExecutedCommand | undefined): void {
    if (!executedCommand || !this.isRecordableCommandText(executedCommand)) return;

    const persistedCommand = executedCommand.command.trim();
    const maxEntries = this.historyLimit();
    const groupId = this.commandLog.sessionGroupId;
    const details = {
      durationMs: executedCommand.duration,
      returnCode: executedCommand.returnCode,
    };

    if (!this.isSuggestable(executedCommand)) {
      this.commandLog.write((writer) =>
        writer.appendCommandExecution(
          persistedCommand,
          executedCommand.directory,
          groupId,
          maxEntries,
          details,
        ),
      );
      return;
    }

    const recentPreviousCommand = this.commandLog.transitionSourceCommand();
    this.commandLog.write(async (writer) => {
      await writer.upsertCommandExecution(
        persistedCommand,
        executedCommand.directory,
        groupId,
        maxEntries,
        details,
      );

      if (recentPreviousCommand) {
        await writer.upsertCommandTransition(recentPreviousCommand, persistedCommand);
      }
    });

    this.commandLog.recordExecutionForTransition(persistedCommand, Date.now());
  }

  private async importShellHistory(
    writer: CommandLogWriter,
    shellContext: ResolvedShellContextContract,
  ): Promise<void> {
    try {
      const homeDir = await this.paths.homeDir();
      const entries = await this.historyReader.read(
        shellContext.shellType,
        shellContext.backendOs,
        homeDir,
      );
      if (entries.length === 0) return;

      const maxEntries = this.historyLimit();
      const deduplicated = deduplicateByCommand(entries);
      const limited =
        maxEntries === undefined
          ? deduplicated
          : deduplicated.slice(deduplicated.length - maxEntries);

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
   * entry. It never reported a return code, so a return-code list would keep it
   * out of suggestions, yet it ran like any other command. Same text filters, no
   * return-code gate; awaited so it reaches the log before the process exits.
   */
  async recordAbortedCommand(executedCommand: ExecutedCommand): Promise<void> {
    if (!this.isRecordableCommandText(executedCommand)) return;

    const persistedCommand = executedCommand.command.trim();
    const groupId = this.commandLog.sessionGroupId;
    const maxEntries = this.historyLimit();

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
  private isRecordableCommandText(executedCommand: ExecutedCommand): boolean {
    if (executedCommand.command === undefined) return false;
    if (
      this.configService.config.terminal?.history?.ignore_commands_with_leading_space &&
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

  /** Whether autocomplete may offer the command; the history keeps it either way. */
  private isSuggestable(executedCommand: ExecutedCommand): boolean {
    // A command the shell could not find is a typo, whatever its return code.
    if (executedCommand.commandExists === false) return false;
    return this.isReturnCodeAllowed(
      firstToken(executedCommand.command),
      executedCommand.returnCode,
    );
  }

  /** How many commands the history keeps; `undefined` when it is unlimited. */
  private historyLimit(): number | undefined {
    const limit = resolveLimit(this.configService.config.terminal?.history?.max_entries, UNLIMITED);
    return Number.isFinite(limit) ? limit : undefined;
  }

  /**
   * The configured return-code filter for suggestions: the command's own list,
   * else the global one. An empty list is no filter. With a list set, a command
   * whose result is unknown (no return code) is not suggested.
   */
  private isReturnCodeAllowed(token: string, returnCode: number | undefined): boolean {
    const autocomplete = this.configService.config.autocomplete;
    const allowed =
      autocomplete?.allowed_return_codes_by_command?.[token] ??
      autocomplete?.allowed_return_codes ??
      [];
    if (allowed.length === 0) return true;
    return returnCode !== undefined && allowed.includes(returnCode);
  }
}
