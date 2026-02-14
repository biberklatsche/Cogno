import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

import { Command } from "../../state";
import { OscDataType } from "../model/models";

export type ExecutedCommand = {
    command: string;
    directory: string;
};

@Injectable()
export class TerminalCommandHistoryStore {
    private readonly _historySubject = new BehaviorSubject<Command[]>([]);

    get commands(): Command[] {
        return this._historySubject.value;
    }

    get commands$(): Observable<Command[]> {
        return this._historySubject.asObservable();
    }

    updateCommand(data: Record<OscDataType, string>): ExecutedCommand | undefined {
        const id = data["id"];
        const directory = data["directory"];
        const user = data["user"];
        const machine = data["machine"];

        if (this._historySubject.value.find(c => c.id === id)) {
            return undefined;
        }

        const commands = [...this._historySubject.value];
        let executed: ExecutedCommand | undefined;

        if (commands.length > 0) {
            const lastCommand = commands[commands.length - 1];
            lastCommand.setData(data);

            if (lastCommand.command && lastCommand.directory) {
                executed = {
                    command: lastCommand.command,
                    directory: lastCommand.directory,
                };
            }
        }

        const command = new Command(id, directory, machine, user);
        commands.push(command);
        this._historySubject.next(commands);

        return executed;
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
}
