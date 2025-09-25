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
        if (theme.enableWebgl) {
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
        this.terminal!.options.fontSize = this.theme.fontsize;
        this.terminal!.options.fontFamily = `'${this.theme.fontFamily}', monospace`;
        this.terminal!.options.fontWeight = this.theme.fontWeight;
        this.terminal!.options.fontWeightBold = this.theme.fontWeightBold;
        this.terminal!.options.cursorWidth = this.theme.cursorWidth;
        this.terminal!.options.cursorBlink = this.theme.cursorBlink;
        this.terminal!.options.cursorStyle = this.theme.cursorStyle;
        this.terminal!.options.theme = {
            background: '#00000000',
            cursor: this.theme.colors.cursor ? `${this.theme.colors.cursor}CC` : `${this.theme.colors.highlight}CC`,
            cursorAccent: `${this.theme.colors.highlight}66`,
            foreground: this.theme.colors.foreground,
            selectionBackground: `${this.theme.colors.highlight}88`,
            selectionInactiveBackground: `${this.theme.colors.highlight}55`,
            black: this.theme.colors.black,
            red: this.theme.colors.red,
            green: this.theme.colors.green,
            yellow: this.theme.colors.yellow,
            blue: this.theme.colors.blue,
            magenta: this.theme.colors.magenta,
            cyan: this.theme.colors.cyan,
            white: this.theme.colors.brightWhite,
            brightBlack: this.theme.colors.brightBlack,
            brightRed: this.theme.colors.brightRed,
            brightGreen: this.theme.colors.brightGreen,
            brightYellow: this.theme.colors.brightYellow,
            brightBlue: this.theme.colors.brightBlue,
            brightMagenta: this.theme.colors.brightMagenta,
            brightCyan: this.theme.colors.brightCyan,
            brightWhite: this.theme.colors.brightWhite,
        };
        setTimeout(() => this.resize(), 200);
    }

    private resize() {
        this.fitAddon.fit();
        if(!this.terminal) return;
        this.pty?.resize(this.terminal.cols, this.terminal.rows);
    }
}
