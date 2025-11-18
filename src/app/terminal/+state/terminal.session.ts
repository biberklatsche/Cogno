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
import {ContextMenuItem} from "../../menu/context-menu-overlay/context-menu-overlay.types";
import {SelectionHandler} from "./handler/selection.handler";

import {InputHandler} from "./handler/input.handler";
import {KeybindExecutor} from "./keybind/keybind.executor";
import {FullScreenAppHandler} from "./handler/full-screen-app.handler";
import {MouseHandler} from "./handler/mouse.handler";
import {CursorHandler} from "./handler/cursor.handler";

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
        this.focusHandler = new FocusHandler(this.terminalId, this.bus);
        this.selectionHandler = new SelectionHandler(this.bus, this.configService, this.terminalId);
        this.disposables.push(this.renderer.register(new PtyHandler(this.terminalId, this.pty, this.configService, this.bus)));
        this.disposables.push(this.renderer.register(new ResizeHandler(this.terminalId, this.pty, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new ThemeHandler(this.terminalId, this.configService, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new TabTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(new FullScreenAppHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(this.focusHandler));
        this.disposables.push(this.renderer.register(this.selectionHandler));
        this.disposables.push(this.renderer.register(new InputHandler(this.bus, this.terminalId)));
        this.disposables.push(this.renderer.register(new MouseHandler(this.bus, terminalContainer, this.terminalId)));
        this.disposables.push(this.renderer.register(new CursorHandler(this.bus, this.terminalId)));
        this.disposables.push(new KeybindExecutor(this.bus, this.focusHandler, this.selectionHandler, this.terminalId))
    }

    buildContextMenu(): ContextMenuItem[] {
        const items: ContextMenuItem[] = [
            { label: 'Paste', action: async () => {
                this.focusHandler?.focus();
                this.bus.publish({path: ['app', 'terminal'], type: 'Paste', payload: this.terminalId});
            }, actionName: 'paste' },
            { separator: true },
            { label: 'Split Right', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'SplitPaneRight', payload: this.terminalId});
                }, actionName: "split_right" },
            { label: 'Split Left', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'SplitPaneLeft', payload: this.terminalId});
                }, actionName: "split_left" },
            { label: 'Split Down', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'SplitPaneDown', payload: this.terminalId});
                }, actionName: "split_down"  },
            { label: 'Split Up', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'SplitPaneUp', payload: this.terminalId});
                }, actionName: "split_up"  },
            { separator: true },
            { label: 'Clear', action: () => {
                    this.focusHandler?.focus();
                    this.bus.publish({path: ['app', 'terminal'], type: 'ClearBuffer', payload: this.terminalId});
                }, actionName: "clear_buffer" },
            { label: 'Close', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'RemovePane', payload: this.terminalId});
                }, actionName: "close_terminal"  },
        ];
        if(this.selectionHandler?.hasSelection()){
            items.unshift({ label: 'Copy', action: () => {
                    this.focusHandler?.focus();
                    this.bus.publish({path: ['app', 'action'], type: 'ActionFired', payload: 'copy'});
                }, actionName: 'copy'
            })
        }
        return items;
    }

    dispose() {
        if (this.disposed) return;
        this.bus.publish({type: 'TerminalRemoved', path: ['app', 'terminal'], payload: this.terminalId});
        this.disposed = true;
        this.renderer.dispose();
        this.pty.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.subscription.unsubscribe();
    }

    focus(): void{
        this.focusHandler?.focus();
    }
}
