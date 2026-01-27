import {ShellType} from "../../config/+models/config";

export type Position = { col: number, row: number };
export type TerminalCursorPosition = Position & {
    viewport: Position,
    char: string
}

export type TerminalMousePosition = Position & {
    viewport: Position,
    char: string,
}

export type TerminalDimensions = { rows: number; cols: number; cellHeight: number; cellWidth: number };

export type TerminalInput = {
    cursorIndex: number,
    maxCursorIndex: number,
    text: string,
}

export type TerminalState = {
    terminalId: string;
    shellType: ShellType;
    cursorPosition: TerminalCursorPosition;
    mousePosition: TerminalMousePosition;
    dimensions: TerminalDimensions;
    isFocused: boolean;
    isCommandRunning: boolean;
    commandStartTime: number | undefined;
    input: TerminalInput;
    cwd: string;
}

export const INITIAL_STATE: TerminalState = {
    terminalId: '',
    cwd: '',
    shellType: 'Bash',
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
    dimensions: {rows: 0, cols: 0, cellHeight: 0, cellWidth: 0},
    isFocused: false,
    isCommandRunning: false,
    commandStartTime: undefined,
    input: {cursorIndex: 0, maxCursorIndex: 0, text: ''}
}
