import {ITerminalHandler} from "./handler";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {IDisposable} from "../../../common/models/models";
import {ConfigService} from "../../../config/+state/config.service";
import {AppBus, MessageBase} from "../../../app-bus/app-bus";
import {TerminalId} from "../../../grid-list/+model/model";
import {Config} from "../../../config/+models/config";

export type TerminalThemeChangedEvent = MessageBase<"TerminalThemeChanged", TerminalId>;

export class ThemeHandler implements ITerminalHandler {

    private readonly subscription= new Subscription();
    private _terminal?: Terminal;

    constructor(private _terminalId: TerminalId, private _configService: ConfigService, private _bus: AppBus) {}

    public configureTerminal(config: Config) {
        if(!this._terminal) throw new Error("Terminal has no terminal");
        this._terminal.options.scrollback = config.scrollback_lines;
        this._terminal.options.fontSize = config.font.size;
        this._terminal.options.fontFamily = `'${config.font.family}', monospace`;
        this._terminal.options.fontWeight = config.font.weight;
        this._terminal.options.fontWeightBold = config.font.weight_bold;
        this._terminal.options.cursorWidth = config.cursor.width;
        this._terminal.options.cursorBlink = config.cursor.blink;
        this._terminal.options.cursorStyle =  config.cursor.style;
        this._terminal.options.theme = {
            background: '#00000000',
            cursor: config.cursor.color ? `${config.cursor.color}CC` : `${config.color.highlight}CC`,
            cursorAccent: `${config.color.highlight}66`,
            foreground: config.color.foreground,
            selectionBackground: `${config.color.highlight}88`,
            selectionInactiveBackground: `${config.color.highlight}55`,
            black: config.color.black,
            red: config.color.red,
            green: config.color.green,
            yellow: config.color.yellow,
            blue: config.color.blue,
            magenta: config.color.magenta,
            cyan: config.color.cyan,
            white: config.color.bright_white,
            brightBlack: config.color.bright_black,
            brightRed: config.color.bright_red,
            brightGreen: config.color.bright_green,
            brightYellow: config.color.bright_yellow,
            brightBlue: config.color.bright_blue,
            brightMagenta: config.color.bright_magenta,
            brightCyan: config.color.bright_cyan,
            brightWhite: config.color.bright_white,
        };
        this._bus.publish({path: ['app', 'terminal', this._terminalId], type: "TerminalThemeChanged"});
    }

    dispose(): void {
        this.subscription?.unsubscribe();
    }

    register(terminal: Terminal): IDisposable {
        this._terminal = terminal;
        this.subscription.add(this._configService.config$.subscribe(config => {
            this.configureTerminal(config);
        }));
        return this;
    }

}
