import {ShellType} from "../../config/+models/config";
import {BehaviorSubject, debounceTime, skip} from "rxjs";
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

export type TerminalDimensions = { rows: number; cols: number };

export type Command = {
    command: string,
    directory: string,
    returnCode: number | null,
    id: string,

}

export type InternalState = {
    terminalId: string;
    shellType: ShellType;
    cursorPosition: TerminalCursorPosition;
    mousePosition: TerminalMousePosition;
    dimensions: TerminalDimensions;
    isFocused: boolean;
    isCommandRunning: boolean;
    input: string;
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
            dimensions: { rows: 0, cols: 0 },
            isFocused: false,
            isCommandRunning: false,
            input: ''
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
            isCommandRunning: value
        });
    }

    get input() { return this._stateSubject.value.input; }
    set input(value: string) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            input: value
        });
    }

    get terminalId() { return this._stateSubject.value.terminalId; }
    get shellType() { return this._stateSubject.value.shellType; }

    get commands() { return this._stateSubject.value.commands; }
    addCommand(command: Command) {
        this._stateSubject.next({
            ...this._stateSubject.value,
            commands: [...this._stateSubject.value.commands, command]
        });
    }
}
