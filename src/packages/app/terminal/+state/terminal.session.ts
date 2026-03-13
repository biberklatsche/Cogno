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
import { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import { AppWiringService } from "@cogno/app-setup/app-host/app-wiring.service";
import {PaneMaximizedChangedEvent} from "../../grid-list/+bus/events";
import {LinkHandler} from "./handler/link.handler";
import {DialogRef, DialogService} from "../../common/dialog";
import {
    TerminalSystemInfoDialogComponent,
    TerminalSystemInfoDialogData,
    TerminalSystemInfoSource
} from "../system-info/terminal-system-info-dialog.component";
import {TerminalNotificationHandler} from "./handler/terminal-notification.handler";
import {NotificationChannels} from "../../notification/+bus/events";
import { NotificationChannelContract } from "@cogno/core-sdk";

type NotificationChannelId = string;

@Injectable()
export class TerminalSession {

    private renderer: IRenderer;
    private pty: IPty = new Pty();

    private focusHandler?: FocusHandler = undefined;

    private subscription: Subscription = new Subscription();
    private readonly disposables: IDisposable[];
    private disposed: boolean = false;
    private processInfoDialogReference?: DialogRef<void>;
    private sessionNotificationChannels?: NotificationChannels;

    private terminalId?: TerminalId;
    private shellProfile?: ShellProfile;


    constructor(
        private configService: ConfigService,
        private bus: AppBus,
        private stateManager: TerminalStateManager,
        private terminalAutocompleteFeatureSuggestorService: TerminalAutocompleteFeatureSuggestorService,
        private dialog: DialogService,
        private wiringService: AppWiringService,
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
        this.sessionNotificationChannels = this.getDefaultSessionNotificationChannels();
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
        this.disposables.push(this.renderer.register(new TerminalNotificationHandler(
            this.bus,
            this.stateManager,
            () => ({...this.getSessionNotificationChannels()})
        )));
        this.disposables.push(this.renderer.register(new FullScreenAppHandler(this.terminalId, this.bus, this.stateManager)));
        this.disposables.push(this.renderer.register(this.focusHandler));
        this.disposables.push(this.renderer.register(new SelectionHandler(this.bus, this.configService, this.terminalId, this.stateManager)));
        this.disposables.push(this.renderer.register(new InputHandler(this.bus, this.terminalId, this.stateManager, this.pty)));
        this.disposables.push(this.renderer.register(new TerminalSearchHandler(this.bus, this.terminalId, this.configService)));
        this.disposables.push(this.renderer.register(new MouseHandler(terminalContainer, this.stateManager)));
        this.disposables.push(this.renderer.register(new CursorHandler(this.stateManager)));
        this.disposables.push(this.renderer.register(new LinkHandler(this.stateManager)));
        this.disposables.push(new KeybindExecutor(this.bus, this.stateManager))

        if(this.shellProfile.enable_shell_integration) {
            this.terminalAutocompleteFeatureSuggestorService.preloadForShellIntegration(this.shellProfile.shell_type);
            this.disposables.push(this.renderer.register(new CommandLineObserver(this.stateManager, this.configService.getPromptSegments())));
            const shellDefinition = this.wiringService
                .getShellDefinitions()
                .find(definition => definition.support.shellType === this.shellProfile?.shell_type);
            this.disposables.push(this.renderer.register(new CommandLineEditor(
                this.bus,
                this.pty,
                this.stateManager,
                shellDefinition?.lineEditor,
            )));
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

    buildHeaderMenu(): ContextMenuItem[] {
        const items: ContextMenuItem[] = this.buildNotificationContextMenuItems();
        items.push({
            label: 'Process Info',
            action: () => this.openProcessInfoDialog(),
        });
        return items;
    }

    dispose() {
        if (this.disposed) return;
        this.processInfoDialogReference?.close();
        this.processInfoDialogReference = undefined;
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

    insertPaths(paths: readonly string[]): void {
        if (!this.terminalId) {
            return;
        }

        const renderedPaths = paths
            .map((path) => this.renderInsertablePath(path))
            .filter((path): path is string => Boolean(path));

        if (renderedPaths.length === 0) {
            return;
        }

        this.bus.publish({
            path: ["app", "terminal"],
            type: "InjectTerminalInput",
            payload: {
                terminalId: this.terminalId,
                text: renderedPaths.join(" "),
            },
        });
    }

    private openProcessInfoDialog(): void {
        if (!this.terminalId) {
            return;
        }

        this.processInfoDialogReference?.close();
        this.processInfoDialogReference = this.dialog.open<TerminalSystemInfoDialogData, void>(
            TerminalSystemInfoDialogComponent,
            {
                title: 'Terminal System Info',
                maxWidth: '100vw',
                hasBackdrop: false,
                movable: true,
                resizable: true,
                showCloseButton: true,
                position: { right: '16px', bottom: '16px' },
                data: {
                    terminalId: this.terminalId,
                    systemInfo: this.getSystemInfoSource()
                }
            }
        );
    }

    private getSystemInfoSource(): TerminalSystemInfoSource {
        return {
            state$: this.stateManager.state$,
            commands$: this.stateManager.commands$,
        };
    }

    private renderInsertablePath(path: string): string | undefined {
        return this.stateManager.renderPathForInsertion(path);
    }

    private buildNotificationContextMenuItems(): ContextMenuItem[] {
        const availableNotificationChannels = this.getAvailableNotificationChannels();
        if (availableNotificationChannels.length === 0) {
            return [];
        }

        const channels = this.getSessionNotificationChannels();
        const items: ContextMenuItem[] = [];

        for (const notificationChannel of availableNotificationChannels) {
            items.push({
                label: notificationChannel.displayName,
                toggle: true,
                toggled: channels[notificationChannel.id] ?? false,
                closeOnSelect: false,
                action: (item?: ContextMenuItem) => this.toggleSessionNotificationChannel(notificationChannel.id, item),
            });
        }
        if (items.length > 0) {
            items.push({separator: true});
            items.unshift({header: true, label: 'Notification'})
        }

        return items;
    }

    private getSessionNotificationChannels(): NotificationChannels {
        if (!this.sessionNotificationChannels) {
            this.sessionNotificationChannels = this.getDefaultSessionNotificationChannels();
        }
        return this.sessionNotificationChannels;
    }

    private toggleSessionNotificationChannel(notificationChannelId: NotificationChannelId, item?: ContextMenuItem): void {
        const availability = this.getNotificationAvailability();
        if (!availability[notificationChannelId]) {
            return;
        }

        const channels = this.getSessionNotificationChannels();
        const nextValue = !(channels[notificationChannelId] ?? false);
        this.sessionNotificationChannels = {
            ...channels,
            [notificationChannelId]: nextValue,
        };
        if (item?.toggle) {
            item.toggled = nextValue;
        }
    }

    private getDefaultSessionNotificationChannels(): NotificationChannels {
        const availability = this.getNotificationAvailability();
        const defaults = this.getNotificationDefaults();
        const notificationChannels: Record<string, boolean> = {};
        for (const notificationChannel of this.getRegisteredNotificationChannels()) {
            notificationChannels[notificationChannel.id] =
                (availability[notificationChannel.id] ?? false)
                && (defaults[notificationChannel.id] ?? false);
        }
        return notificationChannels;
    }

    private getNotificationAvailability(): NotificationChannels {
        const notificationsConfig = this.configService.config.notifications as
            | Readonly<Record<string, { readonly available?: boolean }>>
            | undefined;
        const notificationAvailability: Record<string, boolean> = {};

        for (const notificationChannel of this.getRegisteredNotificationChannels()) {
            const notificationChannelConfiguration = notificationsConfig?.[notificationChannel.id];
            notificationAvailability[notificationChannel.id] =
                (notificationChannelConfiguration?.available ?? true)
                && (notificationChannel.isAvailable?.() ?? true);
        }

        return notificationAvailability;
    }

    private getNotificationDefaults(): NotificationChannels {
        const notificationsConfig = this.configService.config.notifications as
            | Readonly<Record<string, { readonly enabled?: boolean }>>
            | undefined;
        const notificationDefaults: Record<string, boolean> = {};

        for (const notificationChannel of this.getRegisteredNotificationChannels()) {
            notificationDefaults[notificationChannel.id] =
                notificationsConfig?.[notificationChannel.id]?.enabled ?? false;
        }

        return notificationDefaults;
    }

    private getAvailableNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
        const availability = this.getNotificationAvailability();
        return this.getRegisteredNotificationChannels()
            .filter((notificationChannel) => availability[notificationChannel.id] ?? false)
            .sort(
                (leftNotificationChannel, rightNotificationChannel) =>
                    rightNotificationChannel.sortOrder - leftNotificationChannel.sortOrder,
            );
    }

    private getRegisteredNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
        return this.wiringService.getNotificationChannels();
    }
}
