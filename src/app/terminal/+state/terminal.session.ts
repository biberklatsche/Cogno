import {ConfigService} from "../../config/+state/config.service";
import {IPty, Pty} from "../../_tauri/pty";
import {IRenderer, Renderer} from "./renderer";
import {filter, first, Subscription} from "rxjs";
import {IDisposable} from "../../common/models/models";
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";

export class TerminalSession {

    private pty: IPty = new Pty();
    private renderer: IRenderer = new Renderer();
    private readonly subscription= new Subscription();
    private readonly disposables: IDisposable[] = [this.renderer];
    private disposed: boolean = false;

    constructor(private configService: ConfigService, private bus: AppBus, private terminalId: TerminalId) {
        this.subscription.add(this.configService.activeTheme$.pipe(filter(t => !!t), first()).subscribe(theme => {
            if (theme.enable_webgl) {
                this.renderer.useWebGl();
            } else {
                this.renderer.useCanvas();
            }
        }));
        this.subscription.add(this.configService.activeTheme$.subscribe(theme => {
            this.renderer.setTheme(theme, theme.scrollbackLines);
        }));
        this.subscription.add(this.bus.on$({path: ['app', 'terminal', terminalId], type: 'FocusTerminalCommand'}).subscribe(event => {
            event.propagationStopped = true;
            setTimeout(() => this.renderer.focus());
        }));
    }

    spawnPty(terminalId: TerminalId) {
        const shellConfig = this.configService.config.shell[1]!;
        this.pty.spawn(terminalId, shellConfig);
    }

    bindRenderer(terminalContainer: HTMLDivElement): void {
        this.renderer.open(terminalContainer);
        this.spawnPty(this.terminalId);
        this.disposables.push(this.pty?.onData(data => this.renderer?.write(data)));
        this.disposables.push(this.renderer.onData(data => this.pty?.write(data)));
        this.bus.publish({type: "TerminalInitializedEvent", payload: this.terminalId});
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const d of this.disposables.splice(0)) {
            try { d.dispose(); } catch {}
        }
        this.pty.kill();
        this.subscription.unsubscribe();
    }
}
