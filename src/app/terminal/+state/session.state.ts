import {ShellType} from "../../config/+models/config";
import {BehaviorSubject, debounceTime, map, Observable, skip} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";

export type Position = {col: number, row: number};
export type TerminalCursorPosition = Position & {
    viewport: Position,
    char: string
}

export type TerminalMousePosition = Position & {
    viewport: Position,
    char: string,
}

export type TerminalDimensions = { rows: number; cols: number; cellHeight: number; cellWidth: number };

export class Command {
    private data: Record<string, string> = {};
    public isInViewport: boolean = false;

    constructor(
        private _id: string,
        private _directory: string,
        private _machine: string,
        private _user: string) {
    }

    setData(data: Record<string, string>) {
        this.data = data;
    }

    get directory(): string | undefined { return this._directory; }
    get machine(): string | undefined { return this._machine; }
    get user(): string | undefined { return this._user; }

    get command(): string | undefined { return this.data['command']; }
    get duration(): number | undefined {
        const d = this.data['duration'];
        return d !== undefined ? Number.parseInt(d) : undefined;
    }
    get returnCode(): number | undefined {
        const rc = this.data['returnCode'];
        return rc !== undefined ? Number.parseInt(rc) : undefined;
    }

    get id(): string { return this._id;}

    get(key: string): string | undefined {
        return this.data[key];
    }

    set(key: string, value: string): void {
        this.data[key] = value;
    }
}

export type TerminalInput = {
    cursorIndex: number,
    maxCursorIndex: number,
    text: string,
}

export type InternalState = {
    terminalId: string;
    shellType: ShellType;
    cursorPosition: TerminalCursorPosition;
    mousePosition: TerminalMousePosition;
    dimensions: TerminalDimensions;
    isFocused: boolean;
    isCommandRunning: boolean;
    commandStartTime: number | undefined;
    input: TerminalInput;
    commands: Command[];
}

export class SessionState {
    private _stateSubject: BehaviorSubject<InternalState>;

    constructor(
        terminalId: string,
        shellType: ShellType,
        private _bus: AppBus
    ) {
        this._stateSubject = new BehaviorSubject<InternalState>({
            terminalId,
            shellType,
            commands: [],
            cursorPosition: {
                viewport: {col: 1, row: 1},
                col: 1, row: 1,
                char: ''
            },
            mousePosition: {
                viewport: {col: 1, row: 1},
                col: 1, row: 1,
                char: ''
            },
            dimensions: { rows: 0, cols: 0, cellHeight: 0, cellWidth: 0 },
            isFocused: false,
            isCommandRunning: false,
            commandStartTime: undefined,
            input: {cursorIndex: 0, maxCursorIndex: 0, text: ''}
        });

        this._stateSubject.pipe(
            skip(1), // Initialen State ignorieren
            debounceTime(0) // Damit multiple Änderungen in einem Frame zusammengefasst werden
        ).subscribe((state) => {
            this._bus.publish({
                path: ['inspector'],
                type: 'Inspector',
                payload: { type: 'terminal-state', data: {...state} }
            });
        });
    }

    get cursorPosition() { return this._stateSubject.value.cursorPosition; }
    set cursorPosition(value: TerminalCursorPosition) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            cursorPosition: value
        });
    }

    get mousePosition() { return this._stateSubject.value.mousePosition; }
    set mousePosition(value: TerminalMousePosition) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            mousePosition: value
        });
    }

    get dimensions() { return this._stateSubject.value.dimensions; }
    set dimensions(value: TerminalDimensions) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            dimensions: value
        });
    }

    get isFocused() { return this._stateSubject.value.isFocused; }
    set isFocused(value: boolean) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            isFocused: value
        });
    }

    get isCommandRunning() { return this._stateSubject.value.isCommandRunning; }
    set isCommandRunning(value: boolean) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            isCommandRunning: value,
            commandStartTime: value ? Date.now() : this._stateSubject.value.commandStartTime,
            input: value ? {...this._stateSubject.value.input, text: '', maxCursorIndex: 0, cursorIndex: 0} : this._stateSubject.value.input
        });
    }

    get commandDuration() {
        return this._stateSubject.value.commandStartTime !== undefined ? Date.now() - this._stateSubject.value.commandStartTime : undefined;
    }

    get input(): TerminalInput { return this._stateSubject.value.input; }
    set input(value: TerminalInput) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            input: value
        });
    }

    get terminalId() { return this._stateSubject.value.terminalId; }
    get shellType() { return this._stateSubject.value.shellType; }

    get commands() { return this._stateSubject.value.commands; }

    updateCommandList(data: Record<string, string>) {
        const commands = [...this._stateSubject.value.commands];
        const id = data['id'];
        const directory = data['directory'];
        const user = data['user'];
        const machine = data['machine'];
        const index = commands.findIndex(c => c.id === id);
        if(index !== -1) return;
        if(commands.length > 0) {
            const previousCommand = commands[commands.length -1];
            delete data['id'];
            delete data['directory'];
            delete data['user'];
            delete data['machine'];
            previousCommand.setData(data);
        }
        commands.push(new Command(id, directory, machine, user));
        this._stateSubject.next({
            ...this._stateSubject.value,
            commands: commands
        });
    }
}
