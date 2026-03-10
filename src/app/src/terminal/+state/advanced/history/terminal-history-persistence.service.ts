import { Injectable } from "@angular/core";
import { BehaviorSubject, EMPTY, from, Subject } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";

import { Logger } from "../../../../_tauri/logger";
import { IPathAdapter } from "@cogno/core-sdk";
import { ShellContext } from "../model/models";
import { CommandHistoryRow, DirectoryHistoryRow, HistoryRepository } from "./history.repository";
import {ExecutedCommand} from "./terminal-command-history.store";

type PersistenceAction = (repo: HistoryRepository) => Promise<void>;
type ReturnCodePolicy = {
    defaultAllowedCodes: Set<number>;
    perCommandAllowedCodes: Map<string, Set<number>>;
};

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

    constructor() {
        this._actions$
            .pipe(
                concatMap(action =>
                    this._repo$.pipe(
                        filter((r): r is HistoryRepository => r !== null),
                        take(1),
                        concatMap(repo => from(action(repo))),
                        catchError(err => {
                            const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
                            Logger.error(`[TerminalHistoryPersistenceService] action failed: ${detail}`);
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
            .catch(err => Logger.error("[TerminalHistoryPersistenceService] init failed", err));
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
        this.enqueue(repo => repo.upsertCommandExecution(executedCommand!.command, executedCommand!.directory));
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
        this.enqueue(repo => repo.deleteCommandExecution(commandRaw, cwdRaw));
    }

    async searchDirectories(fragment: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
        const repo = this._repo$.value;
        if (!repo) return [];
        return repo.searchDirectories(fragment, limit);
    }

    async searchCommands(fragment: string, cwdRaw: string, limit: number = 50): Promise<CommandHistoryRow[]> {
        const repo = this._repo$.value;
        if (!repo) return [];
        return repo.searchCommands(fragment, cwdRaw, limit);
    }

    markDirectorySelected(pathRaw: string): void {
        if (!pathRaw?.trim()) return;
        this.enqueue(repo => repo.markDirectorySelected(pathRaw));
    }

    markCommandSelected(commandRaw: string, cwdRaw: string): void {
        if (!commandRaw?.trim() || !cwdRaw?.trim()) return;
        this.enqueue(repo => repo.markCommandSelected(commandRaw, cwdRaw));
    }

    private shouldPersistCommand(executedCommand: ExecutedCommand | undefined): boolean {
        if(executedCommand === undefined) return false;
        if(executedCommand.commandExists === false) return false;
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
        if(executedCommand.returnCode === undefined || !Number.isFinite(executedCommand.returnCode)) return false;

        const allowed = this._returnCodePolicy.perCommandAllowedCodes.get(token)
            ?? this._returnCodePolicy.defaultAllowedCodes;
        return allowed.has(executedCommand.returnCode);
    }

    private enqueue(action: PersistenceAction): void {
        this._actions$.next(action);
    }
}
