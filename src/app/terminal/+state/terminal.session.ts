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
import {ContextMenuItem} from "../../common/menu-overlay/menu-overlay.types";
import {SelectionHandler} from "./handler/selection.handler";

export class TerminalSession {

    private renderer: IRenderer = new Renderer();
    private pty: IPty = new Pty();

    private focusHandler?: FocusHandler = undefined;
    private selectionHandler?: SelectionHandler = undefined;

    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[] = [
        this.renderer,
        this.pty
    ];
    private disposed: boolean = false;

    constructor(private configService: ConfigService, private bus: AppBus, private terminalId: TerminalId) {
        this.subscription.add(configService.config$.pipe(filter(t => !!t), first()).subscribe(config => {
            if (config.enable_webgl) {
                this.renderer.useWebGl();
            } else {
                this.renderer.useCanvas();
            }
        }));
    }

    initializeTerminal(terminalContainer: HTMLDivElement): void {
        this.renderer.open(terminalContainer);
        this.focusHandler = new FocusHandler(this.terminalId, this.bus)
        this.selectionHandler = new SelectionHandler()
        this.disposables.push(this.renderer.register(new PtyHandler(this.terminalId, this.pty, this.configService, this.bus)));
        this.disposables.push(this.renderer.register(new ResizeHandler(this.terminalId, this.pty, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new ThemeHandler(this.terminalId, this.configService, this.bus)));
        this.disposables.push(this.renderer.register(new TabTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(this.focusHandler));
        this.disposables.push(this.renderer.register(this.selectionHandler));
    }

    buildContextMenu(): ContextMenuItem[] {
        const items: ContextMenuItem[] = [
            { label: 'Paste', action: () => console.log('Paste terminal', this.terminalId) },
            { separator: true },
            { label: 'Split Right', action: () => console.log('Split right for terminal', this.terminalId) },
            { label: 'Split Left', action: () => console.log('Split left for terminal', this.terminalId) },
            { label: 'Split Down', action: () => console.log('Split down for terminal', this.terminalId) },
            { label: 'Split Up', action: () => console.log('Split up for terminal', this.terminalId) },
            { separator: true },
            { label: 'Clear', action: () => console.log('Clear terminal', this.terminalId) },
        ];
        if(this.selectionHandler?.hasSelection()){
            items.unshift({ label: 'Copy', action: () => {
                    console.log('Copy terminal', this.terminalId);
                    this.focusHandler?.focus();
                } })
        }
        return items;
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
