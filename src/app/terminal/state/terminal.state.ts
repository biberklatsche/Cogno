import {ShellType} from "../../config/+models/config";
import {CommandHistory} from "./command-history";

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
    commandHistory: CommandHistory;
}
