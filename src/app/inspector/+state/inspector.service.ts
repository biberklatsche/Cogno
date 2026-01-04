import {DestroyRef, Injectable, Signal, signal, WritableSignal, computed} from '@angular/core';
import {fromEvent, Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {TerminalDimensions} from "../../terminal/+state/handler/resize.handler";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {InspectorSideComponent} from "../inspector-side/inspector-side.component";
import {FeatureMode, Keybinding} from "../../config/+models/config.types";
import {KeybindService} from "../../keybinding/keybind.service";
import {SideMenuRegistrationTool} from "../../menu/side-menu/+state/side-menu-registration.tool";

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
    private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);
    private _mousePosition: WritableSignal<MousePosition | undefined> = signal(undefined);

    // Per-terminal maps
    private _terminalMouseById: WritableSignal<Record<TerminalId, TerminalMousePosition>> = signal({} as Record<TerminalId, TerminalMousePosition>);
    private _terminalCursorById: WritableSignal<Record<TerminalId, TerminalCursorPosition>> = signal({} as Record<TerminalId, TerminalCursorPosition>);
    private _terminalDimsById: WritableSignal<Record<TerminalId, TerminalDimensions>> = signal({} as Record<TerminalId, TerminalDimensions>);

    // Derived list of terminalIds present in either map
    private _terminalIds = computed<TerminalId[]>(() => {
        const ids = new Set<string>([...Object.keys(this._terminalMouseById()), ...Object.keys(this._terminalDimsById()), ...Object.keys(this._terminalCursorById())]);
        return Array.from(ids) as TerminalId[];
    });

    public get firedKeybinding(): Signal<Keybinding | undefined> {
        return this._firedKeybinding.asReadonly();
    }

    public get mousePosition(): Signal<MousePosition | undefined> {
        return this._mousePosition.asReadonly();
    }

    public get terminalMouseById(): Signal<Record<TerminalId, TerminalMousePosition>> {
        return this._terminalMouseById.asReadonly();
    }

    public get terminalCursorById(): Signal<Record<TerminalId, TerminalMousePosition>> {
        return this._terminalCursorById.asReadonly();
    }

    public get terminalDimsById(): Signal<Record<TerminalId, TerminalDimensions>> {
        return this._terminalDimsById.asReadonly();
    }

    public get terminalIds(): Signal<TerminalId[]> {
        return this._terminalIds;
    }

    private _subscription: Subscription | undefined;


    constructor(
        private sideMenuService: SideMenuService,
        private bus: AppBus,
        private keybinds: KeybindService,
        private menuTool: SideMenuRegistrationTool,
        destroyRef: DestroyRef,
    ) {
        this.menuTool.setup({
            menuItem: {
                label: 'Inspector',
                hidden: false,
                pinned: true,
                icon: 'mdiAlphaIBox',
                component: InspectorSideComponent,
                actionName: 'open_inspector'
            },
            configSelector: (config) => config.inspector?.mode,
            onOpen: () => this.onOpen(),
            onClose: () => this.onClose(),
            onConfigChange: (mode) => this.onConfigChange(mode)
        }, destroyRef);
    }

    onConfigChange(featureMode:FeatureMode) {
        if(featureMode === 'off') {
            this.onClose();
        }
    }

    protected onOpen(): void {
        this._subscription?.unsubscribe();
        this._subscription = new Subscription();
        this._subscription.add(this.bus.on$({type: 'Inspector', path: ['inspector']}).subscribe(event => {
            switch (event.payload?.type) {
                case 'keybind': {
                    this._firedKeybinding.set(event.payload?.data);
                    break;
                }
                case 'terminal-mouse-position': {
                    const data = event.payload!.data as TerminalMousePosition & TerminalIdentifier;
                    if (!data) break;
                    const next = {...this._terminalMouseById()};
                    next[data.terminalId] = data;
                    this._terminalMouseById.set(next);
                    break;
                }
                case 'terminal-cursor-position': {
                    const data = event.payload?.data as TerminalCursorPosition & TerminalIdentifier;
                    if (!data) break;
                    const next = {...this._terminalCursorById()};
                    next[data.terminalId] = data;
                    this._terminalCursorById.set(next);
                    break;
                }
                case 'terminal-dimensions': {
                    const data = event.payload!.data as TerminalDimensions & TerminalIdentifier;
                    if (!data) break;
                    const next = {...this._terminalDimsById()};
                    next[data.terminalId] = data;
                    this._terminalDimsById.set(next);
                    break;
                }
            }
        }));

        // Remove per-terminal data when pane is closed (listen on both app and app/terminal paths)
        this._subscription.add(this.bus.on$({path: ['app', 'terminal'], type: 'TerminalRemoved'}).subscribe(evt => {
            const id = evt.payload;
            if (!id) return;
            const nextMouse = {...this._terminalMouseById()};
            const nextDims = {...this._terminalDimsById()};
            const nextCursor = {...this._terminalCursorById()};
            delete nextMouse[id];
            delete nextDims[id];
            delete nextCursor[id];
            this._terminalMouseById.set(nextMouse);
            this._terminalDimsById.set(nextDims);
            this._terminalCursorById.set(nextCursor);
        }));

        // Track global mouse movement
        this._subscription.add(fromEvent<MouseEvent>(window, 'mousemove')
            .subscribe(evt => {
                this._mousePosition.set({x: evt.clientX, y: evt.clientY});
            }));

        this.keybinds.registerListener(
            'inspector',
            ['Escape'],
            evt => this.sideMenuService.close()
        );
    }

    protected onClose(): void {
        this._subscription?.unsubscribe();
        this._subscription = undefined;
        this.keybinds.unregisterListener('inspector');
    }
}
