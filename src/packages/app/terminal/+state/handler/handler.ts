import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { IDisposable, Terminal } from "@xterm/xterm";

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

export interface ISearchHandler {
  registerSearchAddon(searchAddon: SearchAddon): void;
}

export function isSearchHandler(handler: unknown): handler is ISearchHandler {
  return (
    typeof handler === "object" &&
    handler !== null &&
    "registerSearchAddon" in handler &&
    typeof (handler as ISearchHandler).registerSearchAddon === "function"
  );
}
