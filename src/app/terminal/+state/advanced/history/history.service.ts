import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject, from, EMPTY, Observable } from "rxjs";
import { catchError, concatMap, filter, take } from "rxjs/operators";

import { Command } from "../../state";
import { IPathAdapter } from "../adapter/base/path-adapter.interface";
import {OscDataType, ShellContext} from "../model/models";
import { HistoryRepository } from "./history.repository";
import {Logger} from "../../../../_tauri/logger";

type HistoryFunction = (repo: HistoryRepository) => Promise<void>;

@Injectable({ providedIn: "root" })
export class HistoryService {
    private readonly _repo$ = new BehaviorSubject<HistoryRepository | null>(null);

    private readonly _actions$ = new Subject<HistoryFunction>();

    private readonly _historySubject = new BehaviorSubject<Command[]>([]);

    get commands(): Command[] { return this._historySubject.value; }
    get commands$(): Observable<Command[]> { return this._historySubject.asObservable(); }

    constructor() {
        // serialisierte DB-Queue: Action -> wartet auf repo -> führt aus
        this._actions$
            .pipe(
                concatMap(action =>
                    this._repo$.pipe(
                        filter((r): r is HistoryRepository => r !== null),
                        take(1),
                        concatMap(repo => from(action(repo))),
                        catchError(err => {
                            Logger.error("[HistoryService] action failed", err);
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
            .catch(err => Logger.error("[HistoryService] init failed", err));
    }

    updateCommand(data: Record<OscDataType, string>): void {
        const id = data['id'];
        const directory = data['directory'];
        const user = data['user'];
        const machine = data['machine'];

        // Check if command already exists
        if ( this._historySubject.value.find(c => c.id === id)) {
            return;
        }
        const commands = [...this._historySubject.value];

        // Update previous command if exists
        if (commands.length > 0) {
            const updateData = {...data};
            delete updateData['id'];
            delete updateData['directory'];
            delete updateData['user'];
            delete updateData['machine'];
            const lastCommand = commands[commands.length - 1];
            lastCommand.setData(data);
            this.onCommandExecuted();
        }
        const command = new Command(id, directory, machine, user);
        commands.push(command);
        this._historySubject.next(commands);
    }

    startCommand(currentInputText: string): void {
        const commands = [...this._historySubject.value];
        if (commands.length > 0) {
            const last = commands[commands.length - 1];
            last.set("command", currentInputText.trim());
            this._historySubject.next(commands);
        }
    }

    updateCommands(commands: Command[]): void {
        this._historySubject.next(commands);
    }

    // -------- Persistierung (fire-and-forget) --------

    onCwdChanged(cwdRaw: string): void {
        this.enqueue(repo => repo.upsertWorkingDirectory(cwdRaw));
    }

    onCommandExecuted(): void {
        const commands = this._historySubject.value;
        const lastCommand = commands[commands.length - 1];
        if(lastCommand?.command === undefined) return;
        if (lastCommand.command.trim().startsWith('cd')) return;
        this.enqueue(async repo => await repo.upsertCommandExecution(lastCommand.command!, lastCommand.directory!));
    }

    deleteCommandExecution(commandRaw: string, cwdRaw: string): void {
        this.enqueue(repo => repo.deleteCommandExecution(commandRaw, cwdRaw));
    }

    private enqueue(action: HistoryFunction): void {
        this._actions$.next(action);
    }
}
