import {DestroyRef, Injectable, Signal, signal, WritableSignal, computed} from '@angular/core';
import {fromEvent, Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {InspectorSideComponent} from "../inspector-side/inspector-side.component";
import {ConfigService} from "../../config/+state/config.service";
import {FeatureMode, Keybinding} from "../../config/+models/config";
import {KeybindService} from "../../keybinding/keybind.service";
import {createSideMenuFeature, SideMenuFeature} from "../../menu/side-menu/+state/side-menu-feature";
import {
    TerminalCursorPosition,
    InternalState,
    TerminalMousePosition,
    SessionState
} from '../../terminal/+state/session.state';

export type TerminalIdentifier = { terminalId: string };
export type GlobalMousePosition = { x: number; y: number };

@Injectable({providedIn: 'root'})
export class InspectorService {
    private readonly feature: SideMenuFeature;
    private subscription?: Subscription;

    // State signals
    private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);
    private _globalMousePosition: WritableSignal<GlobalMousePosition | undefined> = signal(undefined);
    private _terminalStateById: WritableSignal<Record<TerminalId, SessionState>> = signal({});
    // Derived signals
    private _terminalIds = computed<TerminalId[]>(() => {
        return Object.keys(this._terminalStateById()) as TerminalId[];
    });

    // Public readonly signals
    public get firedKeybinding(): Signal<Keybinding | undefined> {
        return this._firedKeybinding.asReadonly();
    }

    public get globalMousePosition(): Signal<GlobalMousePosition | undefined> {
        return this._globalMousePosition.asReadonly();
    }

    public get terminalStateById(): Signal<Record<TerminalId, SessionState>> {
        return this._terminalStateById.asReadonly();
    }

    public get terminalIds(): Signal<TerminalId[]> {
        return this._terminalIds;
    }

    constructor(
        sideMenuService: SideMenuService,
        private bus: AppBus,
        config: ConfigService,
        keybinds: KeybindService,
        destroyRef: DestroyRef,
    ) {
        this.feature = createSideMenuFeature(
            {
                label: 'Inspector',
                icon: 'mdiAlphaIBox',
                actionName: 'open_inspector',
                component: InspectorSideComponent,
                configPath: 'inspector',
            },
            {
                onModeChange: (mode: FeatureMode) => this.handleModeChange(mode),
                onOpen: () => this.handleOpen(),
                onClose: () => this.handleClose(),
            },
            { sideMenuService, bus, configService: config, keybinds, destroyRef }
        );
    }

    private handleModeChange(mode: FeatureMode): void {
        if (mode === 'off') {
            this.handleClose();
        }
    }

    private handleOpen(): void {
        this.subscription?.unsubscribe();
        this.subscription = new Subscription();

        // Listen to inspector events
        this.subscription.add(
            this.bus.on$({type: 'Inspector', path: ['inspector']}).subscribe(event => {
                this.handleInspectorEvent(event);
            })
        );

        // Listen to terminal removal events to clean up data
        this.subscription.add(
            this.bus.on$({path: ['app', 'terminal'], type: 'TerminalRemoved'}).subscribe(evt => {
                this.removeTerminalData(evt?.payload);
            })
        );

        // Track global mouse movement
        this.subscription.add(
            fromEvent<MouseEvent>(window, 'mousemove').subscribe(evt => {
                this._globalMousePosition.set({x: evt.clientX, y: evt.clientY});
            })
        );

        // Register keyboard listener for Escape key
        this.feature.registerKeybindListener(
            ['Escape'],
            () => this.feature.close()
        );
    }

    private handleClose(): void {
        this.subscription?.unsubscribe();
        this.subscription = undefined;
        this.feature.unregisterKeybindListener();
    }

    private handleInspectorEvent(event: any): void {
        switch (event.payload?.type) {
            case 'keybind':
                this._firedKeybinding.set(event.payload?.data);
                break;

            case 'terminal-state':
                this.updateTerminalData(event.payload?.data);
                break;
        }
    }

    private updateTerminalData(data: SessionState): void {
        if (!data) return;
        this._terminalStateById.update(current => ({
            ...current,
            [data.terminalId]: data
        }));
    }

    private removeTerminalData(id?: TerminalId): void {
        if (!id) return;

        this._terminalStateById.update(current => {
            const next = {...current};
            delete next[id];
            return next;
        });
    }
}
