import {AfterViewInit, Component, DestroyRef, ElementRef, NgZone, ViewChild} from '@angular/core';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import {CanvasAddon} from '@xterm/addon-canvas';
import {ISearchOptions, SearchAddon} from '@xterm/addon-search';
import {IPty, Pty} from "../_tauri/pty";
import {SettingsService} from "../settings/+state/settings.service";
import {Theme} from "../settings/+models/settings";
import {OS} from "../_tauri/os";
import {LigaturesAddon} from '@xterm/addon-ligatures';
import {WebglAddon} from '@xterm/addon-webgl';



@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.component.html',
    styleUrls: ['./terminal.component.css'],
    standalone: true,
    providers: [Pty]
})
export class TerminalComponent implements AfterViewInit {
    @ViewChild('terminalContainer', {static: true}) terminalContainer!: ElementRef<HTMLDivElement>;

    private terminal: Terminal | undefined = undefined;
    private pty: IPty | undefined = undefined;
    private resizeObserver: ResizeObserver | undefined = undefined;

    private fitAddon = new FitAddon();
    private searchAddon = new SearchAddon();
    private unicodeAddon = new Unicode11Addon();
    private ligaturesAddon: LigaturesAddon | undefined = undefined;
    private webglAddon: WebglAddon | undefined = undefined;
    private canvasAddon: CanvasAddon| undefined = undefined;

    private theme: Theme | undefined = undefined;

    constructor(private settingsService: SettingsService, private zone: NgZone, private destroyRef: DestroyRef) {
        this.pty = new Pty();
    }

    ngAfterViewInit(): void {
        // 1) xterm initialisieren
        this.terminal = new Terminal({
            overviewRulerWidth: 20,
            cursorStyle: 'bar',
            smoothScrollDuration: 0,
            allowTransparency: true,
            altClickMovesCursor: true,
            windowsPty: OS.platform() === 'windows' ? {backend: 'conpty'} : undefined,
            allowProposedApi: true,
            windowOptions: {
                pushTitle: true, //handle CSI Ps=22 vim on gitbash uses this to enter full screen
                popTitle: true //handle CSI Ps=23 vim on gitbash uses this to leaf full screen
            }
        });

        this.terminal.open(this.terminalContainer.nativeElement);

        const ptyOnData = this.pty?.onData(data => this.terminal?.write(data));
        const xtermOnData = this.terminal.onData(data => this.pty?.write(data));
        this.pty?.onExit(e => this.terminal?.dispose());

        // außerhalb von Angular laufen lassen -> keine unnötigen ChangeDetections
        this.zone.runOutsideAngular(() => {
            this.resizeObserver = new ResizeObserver(() => {
                // zurück in Angular kontext, wenn UI/State geändert wird
                this.zone.run(() => this.resize());
            });
            this.resizeObserver.observe(this.terminalContainer.nativeElement, {box: 'content-box'});
        });

        this.destroyRef.onDestroy(() => {
            settingsSubscription.unsubscribe();
            xtermOnData.dispose();
            ptyOnData?.dispose();
            this.terminal?.dispose();
            this.resizeObserver?.disconnect()
        });
        const settingsSubscription = this.settingsService.activeTheme$.subscribe(theme => {
            this.applyAddons(theme);
            this.setTheme(theme, theme.scrollbackLines);
        });
    }

    private applyAddons(theme: Theme) {
        this.terminal!.loadAddon(this.fitAddon);
        this.terminal!.loadAddon(this.searchAddon);
        this.terminal!.loadAddon(this.unicodeAddon);

        this.terminal!.unicode.activeVersion = '11';
        if (theme.enable_webgl) {
            if (!this.webglAddon) {
                this.webglAddon = new WebglAddon();
            }
            this.terminal!.loadAddon(this.webglAddon);
        } else {
            if (!this.canvasAddon) {
                this.canvasAddon = new CanvasAddon();
            }
            this.terminal!.loadAddon(this.canvasAddon);
        }
    }

    private setTheme(t: Theme, scrollbackLines: number) {
        this.theme = t;
        this.terminal!.options.scrollback = scrollbackLines;
        this.terminal!.options.fontSize = this.theme.terminal_font.size;
        this.terminal!.options.fontFamily = `'${this.theme.terminal_font.family}', monospace`;
        this.terminal!.options.fontWeight = this.theme.terminal_font.weight;
        this.terminal!.options.fontWeightBold = this.theme.terminal_font.weight_bold;
        this.terminal!.options.cursorWidth = this.theme.cursor.width;
        this.terminal!.options.cursorBlink = this.theme.cursor.blink;
        this.terminal!.options.cursorStyle = this.theme.cursor.style;
        this.terminal!.options.theme = {
            background: '#00000000',
            cursor: this.theme.color.cursor ? `${this.theme.color.cursor}CC` : `${this.theme.color.highlight}CC`,
            cursorAccent: `${this.theme.color.highlight}66`,
            foreground: this.theme.color.foreground,
            selectionBackground: `${this.theme.color.highlight}88`,
            selectionInactiveBackground: `${this.theme.color.highlight}55`,
            black: this.theme.color.black,
            red: this.theme.color.red,
            green: this.theme.color.green,
            yellow: this.theme.color.yellow,
            blue: this.theme.color.blue,
            magenta: this.theme.color.magenta,
            cyan: this.theme.color.cyan,
            white: this.theme.color.bright_white,
            brightBlack: this.theme.color.bright_black,
            brightRed: this.theme.color.bright_red,
            brightGreen: this.theme.color.bright_green,
            brightYellow: this.theme.color.bright_yellow,
            brightBlue: this.theme.color.bright_blue,
            brightMagenta: this.theme.color.bright_magenta,
            brightCyan: this.theme.color.bright_cyan,
            brightWhite: this.theme.color.bright_white,
        };
        setTimeout(() => this.resize(), 200);
    }

    private resize() {
        this.fitAddon.fit();
        if(!this.terminal) return;
        this.pty?.resize(this.terminal.cols, this.terminal.rows);
    }
}
