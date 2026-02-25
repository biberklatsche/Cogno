import {ConfigService} from "../../config/+state/config.service";
import {IRenderer, Renderer} from "./renderer/renderer";
import {Subscription} from "rxjs";
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
import {TerminalSearchHandler} from "./handler/terminal-search.handler";
import {CommandLineObserver} from "./advanced/ui/command-line.observer";
import {TerminalStateManager} from "./state";
import {CommandLineEditor} from './advanced/ui/command-line.editor';
import {ShellProfile} from "../../config/+models/shell-config";
import {Injectable} from "@angular/core";
import { SpecCommandSuggestorService } from "./advanced/autocomplete/spec/spec-command-suggestor.service";
import {PaneMaximizedChangedEvent} from "../../grid-list/+bus/events";
import {LinkHandler} from "./handler/link.handler";
import {DialogService} from "../../common/dialog";
import {TerminalSystemInfoDialogComponent} from "../system-info/terminal-system-info-dialog.component";

@Injectable()
export class TerminalSession {

    private renderer: IRenderer;
    private pty: IPty = new Pty();

    private focusHandler?: FocusHandler = undefined;

    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[];
    private disposed: boolean = false;

    private terminalId?: TerminalId;
    private shellProfile?: ShellProfile;


    constructor(
        private configService: ConfigService,
        private bus: AppBus,
        private stateManager: TerminalStateManager,
        private specCommandSuggestorService: SpecCommandSuggestorService,
        private dialog: DialogService,
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
        this.stateManager.initialize(terminalId, shellProfile.shell_type!, shellProfile);
        this.subscription.add(
            this.bus.onType$('PaneMaximizedChanged').subscribe((event: PaneMaximizedChangedEvent) => {
                this.stateManager.setPaneMaximized(event.payload?.terminalId === this.terminalId);
            })
        );
    }

    initializeTerminal(terminalContainer: HTMLDivElement): void {
        if (!this.terminalId || !this.shellProfile) {
            throw new Error('TerminalSession must be initialized before initializeTerminal');
        }
        this.renderer.open(terminalContainer, this.configService.config.font?.enable_ligatures ?? false);
        this.focusHandler = new FocusHandler(this.terminalId, this.bus, this.stateManager);
        this.disposables.push(this.renderer.register(new ResizeHandler(this.terminalId, this.pty, this.bus, terminalContainer, this.stateManager)));
        this.disposables.push(this.renderer.register(new PtyHandler(this.terminalId, this.pty, this.shellProfile, this.bus)));
        this.disposables.push(this.renderer.register(new ThemeHandler(this.terminalId, this.configService, this.bus, terminalContainer)));
        this.disposables.push(this.renderer.register(new TerminalTitleHandler(this.terminalId, this.bus)));
        this.disposables.push(this.renderer.register(new FullScreenAppHandler(this.terminalId, this.bus, this.stateManager)));
        this.disposables.push(this.renderer.register(this.focusHandler));
        this.disposables.push(this.renderer.register(new SelectionHandler(this.bus, this.configService, this.terminalId, this.stateManager)));
        this.disposables.push(this.renderer.register(new InputHandler(this.bus, this.terminalId)));
        this.disposables.push(this.renderer.register(new TerminalSearchHandler(this.bus, this.terminalId, this.configService)));
        this.disposables.push(this.renderer.register(new MouseHandler(terminalContainer, this.stateManager)));
        this.disposables.push(this.renderer.register(new CursorHandler(this.stateManager)));
        this.disposables.push(this.renderer.register(new LinkHandler(this.stateManager)));
        this.disposables.push(new KeybindExecutor(this.bus, this.stateManager))

        if(this.shellProfile.enable_shell_integration) {
            this.specCommandSuggestorService.preloadForShellIntegration(this.shellProfile.shell_type);
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
            this.stateManager.isPaneMaximized
                ? { label: 'Minimize', action: () => {
                        this.bus.publish({path: ['app', 'terminal'], type: 'MinimizePane', payload: this.terminalId});
                    }, actionName: "minimize_pane" }
                : { label: 'Maximize', action: () => {
                        this.bus.publish({path: ['app', 'terminal'], type: 'MaximizePane', payload: this.terminalId});
                    }, actionName: "maximize_pane" },
            { separator: true },
            { label: 'Clear', action: () => {
                    this.focusHandler?.focus();
                    this.bus.publish({path: ['app', 'terminal'], type: 'ClearBuffer', payload: this.terminalId});
                }, actionName: "clear_buffer" },
            { label: 'Close', action: () => {
                    this.bus.publish({path: ['app', 'terminal'], type: 'RemovePane', payload: this.terminalId});
                }, actionName: "close_terminal"  },
            { separator: true },
            { label: 'Process Info', action: () => {
                    if (!this.terminalId) return;
                    this.dialog.open(TerminalSystemInfoDialogComponent, {
                        title: 'Terminal System Info',
                        maxWidth: '600px',
                        hasBackdrop: false,
                        showCloseButton: true,
                        position: { right: '16px', bottom: '16px' },
                        data: { terminalId: this.terminalId }
                    });
                } },
        ];
        if(this.stateManager.hasSelection){
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
