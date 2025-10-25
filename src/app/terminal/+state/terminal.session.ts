import {ConfigService} from "../../config/+state/config.service";
import {IAppTerminal, AppTerminal} from "./app-terminal";
import {filter, first, Subscription} from "rxjs";
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TabTitleHandler} from "./handler/tab-title.handler";
import {PtyHandler} from "./handler/pty.handler";
import {IDisposable} from "../../common/models/models";
import {FocusHandler} from "./handler/focus.handler";
import {ThemeHandler} from "./handler/theme.handler";

export class TerminalSession {

    private terminal: IAppTerminal = new AppTerminal();
    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[] = [
        this.terminal
    ];
    private disposed: boolean = false;

    constructor(private configService: ConfigService, private bus: AppBus, private terminalId: TerminalId) {
        this.subscription.add(configService.activeTheme$.pipe(filter(t => !!t), first()).subscribe(theme => {
            if (theme.enable_webgl) {
                this.terminal.useWebGl();
            } else {
                this.terminal.useCanvas();
            }
        }));
    }

    initializeTerminal(terminalContainer: HTMLDivElement): void {
        this.terminal.open(terminalContainer);
        this.disposables.push(this.terminal.register(new PtyHandler(this.terminalId, this.configService, this.bus)));
        this.disposables.push(this.terminal.register(new ThemeHandler(this.configService)));
        this.disposables.push(this.terminal.register(new TabTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.terminal.register(new FocusHandler(this.terminalId, this.bus)));
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.terminal.dispose();
        this.subscription.unsubscribe();
    }
}
