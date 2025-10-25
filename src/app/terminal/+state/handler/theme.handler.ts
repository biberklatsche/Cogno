import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";
import {ConfigService} from "../../../config/+state/config.service";
import {Theme} from "../../../config/+models/config";
import {FitAddon} from "@xterm/addon-fit";

export class ThemeHandler implements ITerminalHandler {

    private readonly subscription= new Subscription();
    private _terminal?: Terminal;
    private _fitAddon?: FitAddon;
    private _theme?: Theme;

    constructor(private _configService: ConfigService) {}

    public setTheme(t: Theme, scrollbackLines: number) {
        if(!this._terminal) throw new Error("Terminal has no terminal");
        this._theme = t;
        this._terminal.options.scrollback = scrollbackLines;
        this._terminal.options.fontSize = this._theme.terminal_font.size;
        this._terminal.options.fontFamily = `'${this._theme.terminal_font.family}', monospace`;
        this._terminal.options.fontWeight = this._theme.terminal_font.weight;
        this._terminal.options.fontWeightBold = this._theme.terminal_font.weight_bold;
        this._terminal.options.cursorWidth = this._theme.cursor.width;
        this._terminal.options.cursorBlink = this._theme.cursor.blink;
        this._terminal.options.cursorStyle = this._theme.cursor.style;
        this._terminal.options.theme = {
            background: '#00000000',
            cursor: this._theme.color.cursor ? `${this._theme.color.cursor}CC` : `${this._theme.color.highlight}CC`,
            cursorAccent: `${this._theme.color.highlight}66`,
            foreground: this._theme.color.foreground,
            selectionBackground: `${this._theme.color.highlight}88`,
            selectionInactiveBackground: `${this._theme.color.highlight}55`,
            black: this._theme.color.black,
            red: this._theme.color.red,
            green: this._theme.color.green,
            yellow: this._theme.color.yellow,
            blue: this._theme.color.blue,
            magenta: this._theme.color.magenta,
            cyan: this._theme.color.cyan,
            white: this._theme.color.bright_white,
            brightBlack: this._theme.color.bright_black,
            brightRed: this._theme.color.bright_red,
            brightGreen: this._theme.color.bright_green,
            brightYellow: this._theme.color.bright_yellow,
            brightBlue: this._theme.color.bright_blue,
            brightMagenta: this._theme.color.bright_magenta,
            brightCyan: this._theme.color.bright_cyan,
            brightWhite: this._theme.color.bright_white,
        };
        setTimeout(() => this._fitAddon?.fit(), 200);
    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    register(terminal: Terminal, fitAddon: FitAddon): IDisposable {
        this._terminal = terminal;
        this._fitAddon = fitAddon;
        this.subscription.add(this._configService.activeTheme$.subscribe(theme => {
            this.setTheme(theme, theme.scrollbackLines);
        }));
        return this;
    }

}
