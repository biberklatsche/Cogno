import {IDisposable, Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";

export interface ITerminalHandler extends IDisposable {
    register(terminal: Terminal, fitAddon?: FitAddon): IDisposable;
}
