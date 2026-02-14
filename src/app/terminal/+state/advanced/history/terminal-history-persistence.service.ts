import { Injectable } from "@angular/core";
import { BehaviorSubject, EMPTY, from, Subject } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";

import { Logger } from "../../../../_tauri/logger";
import { IPathAdapter } from "../adapter/base/path-adapter.interface";
import { ShellContext } from "../model/models";
import { HistoryRepository } from "./history.repository";

type PersistenceAction = (repo: HistoryRepository) => Promise<void>;

@Injectable()
export class TerminalHistoryPersistenceService {
    private readonly _repo$ = new BehaviorSubject<HistoryRepository | null>(null);
    private readonly _actions$ = new Subject<PersistenceAction>();

    constructor() {
        this._actions$
            .pipe(
                concatMap(action =>
                    this._repo$.pipe(
                        filter((r): r is HistoryRepository => r !== null),
                        take(1),
                        concatMap(repo => from(action(repo))),
                        catchError(err => {
                            Logger.error("[TerminalHistoryPersistenceService] action failed", err);
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
        this.enqueue(repo => repo.upsertWorkingDirectory(cwdRaw));
    }

    onCommandExecuted(commandRaw: string, cwdRaw: string): void {
        const command = commandRaw.trim();
        if (!command) return;
        if (command.startsWith("cd")) return;

        this.enqueue(repo => repo.upsertCommandExecution(command, cwdRaw));
    }

    deleteCommandExecution(commandRaw: string, cwdRaw: string): void {
        this.enqueue(repo => repo.deleteCommandExecution(commandRaw, cwdRaw));
    }

    private enqueue(action: PersistenceAction): void {
        this._actions$.next(action);
    }
}
