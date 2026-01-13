import {IDisposable, Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";

export interface ITerminalHandler extends IDisposable {
    registerTerminal(terminal: Terminal): IDisposable;
}

export function isTerminalHandler(h: any): h is ITerminalHandler {
    return typeof h.registerTerminal === "function";
}

export interface IFitHandler {
    registerFitAddon(fitAddon: FitAddon): void;
}

export function isFitHandler(h: any): h is IFitHandler {
    return typeof h.registerFitAddon === "function";
}
