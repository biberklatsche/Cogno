import { Injectable } from "@angular/core";
import { BehaviorSubject, EMPTY, from, Subject } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";

import { IPathAdapter } from "@cogno/core-api";
import { ShellContext } from "../model/models";
import { LearnedCommandPattern } from "./command-pattern.models";
import { CommandHistoryRow, DirectoryHistoryRow, HistoryRepository } from "./history.repository";
import {ExecutedCommand} from "./terminal-command-history.store";
import { ErrorReporter } from "@cogno/app/common/error/error-reporter";

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

function firstToken(commandRaw: string): string {
    const trimmed = commandRaw.trim();
    if (!trimmed) return "";
    const i = trimmed.search(/\s/);
    return (i === -1 ? trimmed : trimmed.slice(0, i)).toLowerCase();
}

@Injectable()
export class TerminalHistoryPersistenceService {
    private readonly _repo$ = new BehaviorSubject<HistoryRepository | null>(null);
    private readonly _actions$ = new Subject<PersistenceAction>();
    private readonly _returnCodePolicy: ReturnCodePolicy = {
        defaultAllowedCodes: new Set([0]),
        perCommandAllowedCodes: new Map<string, Set<number>>(),
    };
    private _lastCwdRaw = "";
    private _recentCommandExecution?: RecentCommandExecution;

    constructor() {
        this._actions$
            .pipe(
                concatMap(action =>
                    this._repo$.pipe(
                        filter((r): r is HistoryRepository => r !== null),
                        take(1),
                        concatMap(repo => from(action(repo))),
                        catchError(err => {
                            ErrorReporter.reportException({
                                error: err,
                                handled: true,
                                source: "TerminalHistoryPersistenceService",
                                context: {
                                    operation: "persistenceAction",
                                },
                            });
                            return EMPTY;
                        })
                    )
                )
            )
            .subscribe();
    }

    initialize(shellContext: ShellContext, adapter: IPathAdapter): void {
        HistoryRepository.createForContext(shellContext, adapter)
            .then(repo => this._repo$.next(repo))
            .catch(error => ErrorReporter.reportException({
                error,
                handled: true,
                source: "TerminalHistoryPersistenceService",
                context: {
                    operation: "initialize",
                },
            }));
    }

    onCwdChanged(cwdRaw: string): void {
        if (!cwdRaw?.trim()) return;
        const cwd = cwdRaw.trim();
        if (cwd === this._lastCwdRaw) return;
        this._lastCwdRaw = cwd;
        this.enqueue(repo => repo.upsertWorkingDirectory(cwdRaw));
    }

    onCommandExecuted(executedCommand: ExecutedCommand | undefined): void {
        if (!this.shouldPersistCommand(executedCommand)) return;
        if (!executedCommand) return;

        const persistedCommand = executedCommand.command.trim();
        const timestamp = Date.now();
        const recentPreviousCommand = this.getRecentTransitionSourceCommand();

        this.enqueue(async (repo) => {
            await repo.upsertCommandPatternExecution(persistedCommand);
            await repo.upsertCommandExecution(persistedCommand, executedCommand.directory);

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
        this.enqueue(async (repo) => {
            await repo.deleteCommandPatternExecution(commandRaw);
            await repo.deleteCommandExecution(commandRaw, cwdRaw);
        });
    }

    async searchDirectories(fragment: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
        const repo = this._repo$.value;
        if (!repo) return [];
        return repo.searchDirectories(fragment, limit);
    }

    async searchCommands(fragment: string, cwdRaw: string, limit: number = 50): Promise<CommandHistoryRow[]> {
        const repo = this._repo$.value;
        if (!repo) return [];
        return repo.searchCommands(fragment, cwdRaw, this.getRecentTransitionSourceCommand(), limit);
    }

    async searchCommandPatterns(fragment: string, limit: number = 50): Promise<LearnedCommandPattern[]> {
        const repo = this._repo$.value;
        if (!repo) return [];
        return repo.searchCommandPatterns(fragment, limit);
    }

    markCommandPatternsShown(signatureKeys: readonly string[]): void {
        if (signatureKeys.length === 0) return;
        this.enqueue(repo => repo.markCommandPatternsShown(signatureKeys));
    }

    markDirectorySelected(pathRaw: string): void {
        if (!pathRaw?.trim()) return;
        this.enqueue(repo => repo.markDirectorySelected(pathRaw));
    }

    markCommandSelected(commandRaw: string, cwdRaw: string): void {
        if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
        this.enqueue(repo => repo.markCommandSelected(commandRaw, cwdRaw));
    }

    markCommandPatternSelected(signatureKey: string): void {
        if (!signatureKey?.trim()) return;
        this.enqueue(repo => repo.markCommandPatternSelected(signatureKey));
    }

    private shouldPersistCommand(executedCommand: ExecutedCommand | undefined): boolean {
        if(executedCommand === undefined) return false;
        if(executedCommand.command === undefined) return false;
        const command = executedCommand.command.trim();
        if(command.length === 0) return false;
        if(command === ':') return false;
        if(command === 'true') return false;
        if(command === 'false') return false;
        if(command.startsWith(' '))return false;
        const token = firstToken(command);
        if (!token) return false;
        if (token === "cd") return false;
        if (executedCommand.commandExists === true) return true;
        if (executedCommand.commandExists === false) return false;
        if(executedCommand.returnCode === undefined || !Number.isFinite(executedCommand.returnCode)) return false;

        const allowed = this._returnCodePolicy.perCommandAllowedCodes.get(token)
            ?? this._returnCodePolicy.defaultAllowedCodes;
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



