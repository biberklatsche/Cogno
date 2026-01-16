import {ShellType} from "../../config/+models/config";
import {BehaviorSubject} from "rxjs";

export type Position = {col: number, row: number};
export type CursorPosition = Position & {
    viewport: Position,
    char: string,
}

export class SessionState {
    public cursorPosition: CursorPosition = {
        viewport: {col: 1, row: 1},
        col: 1, row: 1,
        char: ' '
    };
    public isCommandRunning = false;

    constructor(private _terminalId: string, private _shellType: ShellType) {
    }


    get terminalId() {return this._terminalId;}
    get shellType() {return this._shellType;}
}
