import {ConfigService} from "../../config/+state/config.service";
import {IRenderer, Renderer} from "./renderer/renderer";
import {Observable, Subscription} from "rxjs";
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalTitleHandler} from "./handler/terminal-title.handler";
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
import {ScriptInjector} from "./advanced/script.injector";
import {PathInjector} from "./advanced/path.injector";
import {CommandLineObserver} from "./advanced/command-line.observer";
import {Command, TerminalState, TerminalStateManager} from "./state";
import {CommandLineEditor} from './advanced/command-line.editor';
import {ShellProfile} from "../../config/+models/shell-config";
import {Injectable} from "@angular/core";

@Injectable()
export class TerminalSession {

    private renderer: IRenderer;
    private pty: IPty = new Pty();

    private focusHandler?: FocusHandler = undefined;
    private selectionHandler?: SelectionHandler = undefined;

    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[];
    private disposed: boolean = false;

    private terminalId?: TerminalId;
    private shellProfile?: ShellProfile;


    constructor(
        private configService: ConfigService,
        private bus: AppBus,
        private stateManager: TerminalStateManager
    ) {
        this.renderer = new Renderer(this.configService.config);
        this.disposables = [
            this.renderer,
            this.pty
        ];
    }

    initialize(terminalId: TerminalId, shellProfile: ShellProfile): void {
        this.terminalId = terminalId;
        this.shellProfile = shellProfile;
        this.stateManager.initialize(terminalId, shellProfile.shell_type!);
    }

    initializeTerminal(terminalContainer: HTMLDivElement): void {
        if (!this.terminalId || !this.shellProfile) {
            throw new Error('TerminalSession must be initialized before initializeTerminal');
        }
        this.renderer.open(terminalContainer, this.configService.config.font?.enable_ligatures ?? false);
        this.focusHandler = new FocusHandler(this.terminalId, this.bus, this.stateManager);
        this.selectionHandler = new SelectionHandler(this.bus, this.configService, this.terminalId);
        this.disposables.push(this.renderer.register(new PtyHandler(this.terminalId, this.pty, this.shellProfile, this.bus)));
        this.disposables.push(this.renderer.register(new ResizeHandler(this.terminalId, this.pty, this.bus, terminalContainer, this.stateManager)));
        this.disposables.push(this.renderer.register(new ThemeHandler(this.terminalId, this.configService, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new TerminalTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(new FullScreenAppHandler(this.terminalId, this.bus, this.stateManager)));
        this.disposables.push(this.renderer.register(this.focusHandler));
        this.disposables.push(this.renderer.register(this.selectionHandler));
        this.disposables.push(this.renderer.register(new InputHandler(this.bus, this.terminalId)));
        this.disposables.push(this.renderer.register(new MouseHandler(terminalContainer, this.stateManager)));
        this.disposables.push(this.renderer.register(new CursorHandler(this.stateManager)));
        this.disposables.push(new KeybindExecutor(this.bus, this.focusHandler, this.selectionHandler, this.terminalId))
        if(this.shellProfile.inject_path) {
            this.disposables.push(new PathInjector(this.bus, this.pty, this.terminalId));
        }
        if(this.shellProfile.enable_shell_integration) {
            this.disposables.push(new ScriptInjector(this.bus, this.pty, this.terminalId));
            this.disposables.push(this.renderer.register(new CommandLineObserver(this.stateManager, this.configService.getPromptSegments())));
            this.disposables.push(this.renderer.register(new CommandLineEditor(this.bus, this.pty, this.stateManager)));

        }

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
