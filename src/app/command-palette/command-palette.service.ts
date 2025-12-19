import {DestroyRef, Injectable, signal} from '@angular/core';
import { AppBus } from '../app-bus/app-bus';
import { ACTION_NAMES, ActionFired } from '../action/action.models';
import { ConfigService } from '../config/+state/config.service';
import {
    ActionDefinition,
    KeybindInterpreter
} from '../keybinding/keybind-action.interpreter';
import { KeybindService } from '../keybinding/keybind.service';
import {Subscription} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Grid} from "../common/grid/grid-calculations";
import {SideMenuItemService} from "../menu/side-menu/+state/side-menu-item.service";
import {InspectorSideComponent} from "../inspector/inspector-side/inspector-side.component";
import {ConfigTypes, FeatureMode} from "../config/+models/config.types";
import {SideMenuService} from "../menu/side-menu/+state/side-menu.service";
import {CommandPaletteComponent} from "./command-palette.component";

export type CommandEntry = {
    isSelected: boolean;
    label: string;
    keybinding: string;
    action: ActionDefinition;
};

@Injectable({providedIn: 'root'})
export class CommandPaletteService extends SideMenuItemService {
    private _subscription: Subscription | undefined;

    private readonly _commandList = signal<CommandEntry[]>([]);
    private readonly _filteredCommandList = signal<CommandEntry[]>([]);
    readonly filteredCommandList = this._filteredCommandList.asReadonly();

    constructor(
        protected override sideMenuService: SideMenuService, override bus: AppBus, config: ConfigService, ref: DestroyRef, private keybinds: KeybindService
    ) {
        super(sideMenuService, bus, config, ref, {
                label: 'Command Palette',
                hidden: false,
                icon: 'mdiPaletteSwatch',
                component: CommandPaletteComponent,
                actionName: 'open_command_palette'
            },
            (config: ConfigTypes) => config.command_palette?.mode
        );
    }

    private initCommands(): void {
        const commands = ACTION_NAMES
            .map(actionName => ({
                label: actionName.replaceAll('_', ' '),
                keybinding: '',
                action: { actionName },
                isSelected: false
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        commands.push({label: 'test1', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test2', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test3', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test4', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test5', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test6', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test7', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test8', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test10', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        commands.push({label: 'test9', keybinding: '', action: {actionName: 'clear_buffer'}, isSelected: false});
        this._commandList.set(this.selectFirst(commands));
        this._filteredCommandList.set(this.selectFirst(commands));
    }

    private initConfigListener(): void {
        this._subscription = this.config.config$.subscribe(c => {
            const updated = this.applyKeybindConfig(
                this._commandList(),
                c.keybind ?? []
            );
            this._commandList.set(this.selectFirst(updated));
            this._filteredCommandList.set(this.selectFirst(updated));
        });
    }

    private applyKeybindConfig(
        commands: CommandEntry[],
        keybindLines: string[]
    ): CommandEntry[] {
        const map = new Map(commands.map(c => [c.label, { ...c }]));

        for (const line of keybindLines) {
            const parsed = KeybindInterpreter.parse(line);
            if (!parsed) continue;

            const label = parsed.actionDefinition.actionName.replaceAll('_', ' ');
            const entry = map.get(label);
            if (!entry) continue;

            entry.keybinding = parsed.shortcutDefinition.shortcut;
            entry.action = parsed.actionDefinition;
        }

        return Array.from(map.values()).sort((a, b) =>
            a.label.localeCompare(b.label)
        );
    }

    open(): void {
        this.initCommands();
        this.initConfigListener();
        this.filterCommands('');
        this.keybinds.registerListener(
            'command-palette',
            ['Enter', 'ArrowDown', 'ArrowUp'],
            evt => this.handleKey(evt.key)
        );
    }

    close(): void {
        this._commandList.set([]);
        this._subscription?.unsubscribe();
        this.keybinds.unregisterListener('command-palette');
    }

    protected override onConfigChanged(featureMode: FeatureMode): void {
        if(featureMode == 'off') close();
    }

    protected override onViewChanged(visible: boolean): void {
        console.log('### open!!!!')
        if(visible) this.open();
        else this.close();
    }


    fireAction(command?: CommandEntry): void {
        const selected =
            command ?? this._filteredCommandList().find(c => c.isSelected);
        if (!selected) return;
        this.bus.publish(
            ActionFired.createFromDefinition(selected.action)
        );
    }

    filterCommands(filter: string): void {
        const normalized = filter.toLowerCase();

        const filtered = this._commandList()
            .map(c => ({ ...c, isSelected: false }))
            .filter(c => c.label.toLowerCase().includes(normalized));

        this._filteredCommandList.set(this.selectFirst(filtered));
    }

    private handleKey(key: string): void {
        switch (key) {
            case 'Escape':
                this.close();
                break;
            case 'Enter':
                this.fireAction();
                this.sideMenuService.close();
                break;
            case 'ArrowDown':
                this.selectNext('d');
                break;
            case 'ArrowUp':
                this.selectNext('u');
                break;
        }
    }

    private selectNext(direction: 'u' | 'd'): void {
        const commands = [...this._filteredCommandList()];
        if (commands.length === 0) return;

        const current = commands.findIndex(c => c.isSelected);
        const next = Grid.nextIndex(current, direction, 1, commands.length);
        commands.forEach(c => (c.isSelected = false));
        commands[next].isSelected = true;

        this._filteredCommandList.set(commands);
    }

    private selectFirst(commands: CommandEntry[]): CommandEntry[] {
        if (commands.length === 0) return commands;
        commands.forEach(c => (c.isSelected = false));
        commands[0].isSelected = true;
        return commands;
    }
}
