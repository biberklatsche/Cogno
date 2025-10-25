import {ConfigService} from "../../config/+state/config.service";
import {IRenderer, Renderer} from "./renderer/renderer";
import {filter, first, Subscription} from "rxjs";
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TabTitleHandler} from "./handler/tab-title.handler";
import {PtyHandler} from "./handler/pty.handler";
import {IDisposable} from "../../common/models/models";
import {FocusHandler} from "./handler/focus.handler";
import {ThemeHandler} from "./handler/theme.handler";
import {IPty, Pty} from "./pty/pty";
import {ResizeHandler} from "./handler/resize.handler";

export class TerminalSession {

    private renderer: IRenderer = new Renderer();
    private pty: IPty = new Pty();
    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[] = [
        this.renderer,
        this.pty
    ];
    private disposed: boolean = false;

    constructor(private configService: ConfigService, private bus: AppBus, private terminalId: TerminalId) {
        this.subscription.add(configService.activeTheme$.pipe(filter(t => !!t), first()).subscribe(theme => {
            if (theme.enable_webgl) {
                this.renderer.useWebGl();
            } else {
                this.renderer.useCanvas();
            }
        }));
    }

    initializeTerminal(terminalContainer: HTMLDivElement): void {
        this.renderer.open(terminalContainer);
        this.disposables.push(this.renderer.register(new PtyHandler(this.terminalId, this.pty, this.configService, this.bus)));
        this.disposables.push(this.renderer.register(new ResizeHandler(this.terminalId, this.pty, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new ThemeHandler(this.terminalId, this.configService, this.bus)));
        this.disposables.push(this.renderer.register(new TabTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(new FocusHandler(this.terminalId, this.bus)));
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.renderer.dispose();
        this.pty.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.subscription.unsubscribe();
    }
}
