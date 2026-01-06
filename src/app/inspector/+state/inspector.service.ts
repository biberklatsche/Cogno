import {DestroyRef, Injectable, Signal, signal, WritableSignal, computed} from '@angular/core';
import {fromEvent, Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {InspectorSideComponent} from "../inspector-side/inspector-side.component";
import {ConfigService} from "../../config/+state/config.service";
import {FeatureMode, Keybinding} from "../../config/+models/config.types";
import {KeybindService} from "../../keybinding/keybind.service";
import {createSideMenuFeature, SideMenuFeature} from "../../menu/side-menu/+state/side-menu-feature";

export type TerminalIdentifier = { terminalId: string };
export type MousePosition = { x: number; y: number };
export type TerminalMousePosition = {
    col: number;
    row: number;
    char: string,
    viewportCol: number;
    viewportRow: number;
};
export type TerminalCursorPosition = {
    col: number;
    row: number;
    char: string,
    viewportCol: number;
    viewportRow: number;
};

@Injectable({providedIn: 'root'})
export class InspectorService {
    private readonly feature: SideMenuFeature;
    private subscription?: Subscription;

    // State signals
    private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);
    private _mousePosition: WritableSignal<MousePosition | undefined> = signal(undefined);
    private _terminalMouseById: WritableSignal<Record<TerminalId, TerminalMousePosition>> = signal({});
    private _terminalCursorById: WritableSignal<Record<TerminalId, TerminalCursorPosition>> = signal({});
    private _terminalDimsById: WritableSignal<Record<TerminalId, TerminalDimensions>> = signal({});

    // Derived signals
    private _terminalIds = computed<TerminalId[]>(() => {
        const ids = new Set<string>([
            ...Object.keys(this._terminalMouseById()),
            ...Object.keys(this._terminalDimsById()),
            ...Object.keys(this._terminalCursorById())
        ]);
        return Array.from(ids) as TerminalId[];
    });

    // Public readonly signals
    public get firedKeybinding(): Signal<Keybinding | undefined> {
        return this._firedKeybinding.asReadonly();
    }

    public get mousePosition(): Signal<MousePosition | undefined> {
        return this._mousePosition.asReadonly();
    }

    public get terminalMouseById(): Signal<Record<TerminalId, TerminalMousePosition>> {
        return this._terminalMouseById.asReadonly();
    }

    public get terminalCursorById(): Signal<Record<TerminalId, TerminalCursorPosition>> {
        return this._terminalCursorById.asReadonly();
    }

    public get terminalDimsById(): Signal<Record<TerminalId, TerminalDimensions>> {
        return this._terminalDimsById.asReadonly();
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
                this._mousePosition.set({x: evt.clientX, y: evt.clientY});
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

            case 'terminal-mouse-position':
                this.updateTerminalMouse(event.payload?.data);
                break;

            case 'terminal-cursor-position':
                this.updateTerminalCursor(event.payload?.data);
                break;

            case 'terminal-dimensions':
                this.updateTerminalDimensions(event.payload?.data);
                break;
        }
    }

    private updateTerminalMouse(data: TerminalMousePosition & TerminalIdentifier): void {
        if (!data) return;
        this._terminalMouseById.update(current => ({
            ...current,
            [data.terminalId]: data
        }));
    }

    private updateTerminalCursor(data: TerminalCursorPosition & TerminalIdentifier): void {
        if (!data) return;
        this._terminalCursorById.update(current => ({
            ...current,
            [data.terminalId]: data
        }));
    }

    private updateTerminalDimensions(data: TerminalDimensions & TerminalIdentifier): void {
        if (!data) return;
        this._terminalDimsById.update(current => ({
            ...current,
            [data.terminalId]: data
        }));
    }

    private removeTerminalData(id?: TerminalId): void {
        if (!id) return;

        this._terminalMouseById.update(current => {
            const next = {...current};
            delete next[id];
            return next;
        });

        this._terminalCursorById.update(current => {
            const next = {...current};
            delete next[id];
            return next;
        });

        this._terminalDimsById.update(current => {
            const next = {...current};
            delete next[id];
            return next;
        });
    }
}