import {Injectable, signal} from '@angular/core';
import { AppBus } from '../app-bus/app-bus';
import { ACTION_NAMES, ActionFired } from '../action/action.models';
import { ConfigService } from '../config/+state/config.service';
import {
    ActionDefinition,
    KeybindInterpreter
} from '../keybinding/keybind-action.interpreter';
import { KeybindService } from '../keybinding/keybind.service';
import {Subscription} from "rxjs";
import {Grid} from "../common/grid/grid-calculations";
import {FeatureMode} from "../config/+models/config.types";
import {SideMenuService} from "../menu/side-menu/+state/side-menu.service";
import {CommandPaletteComponent} from "./command-palette.component";
import {useSideMenuRegistration} from "../menu/side-menu/+state/use-side-menu-registration";

export type CommandEntry = {
    isSelected: boolean;
    label: string;
    keybinding: string;
    action: ActionDefinition;
};

@Injectable({providedIn: 'root'})
export class CommandPaletteService {
    private _subscription: Subscription | undefined;

    private readonly _commandList = signal<CommandEntry[]>([]);
    private readonly _filteredCommandList = signal<CommandEntry[]>([]);
    readonly filteredCommandList = this._filteredCommandList.asReadonly();

    constructor(
        private sideMenuService: SideMenuService, private bus: AppBus, private config: ConfigService, private keybinds: KeybindService
    ) {
        useSideMenuRegistration({
            menuItem: {
                label: 'Command Palette',
                hidden: false,
                pinned: false,
                icon: 'mdiPaletteSwatch',
                component: CommandPaletteComponent,
                actionName: 'open_command_palette'
            },
            configSelector: (config) => config.command_palette?.mode,
            onOpen: () => this.onOpen(),
            onClose: () => this.onClose(),
            onConfigChange: (mode) => this.onConfigChange(mode)
        });
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

    protected onConfigChange(featureMode: FeatureMode): void {
        if(featureMode == 'off') this.onClose();
    }

    protected onOpen(): void {
        this.initCommands();
        this.initConfigListener();
        this.filterCommands('');
        this.keybinds.registerListener(
            'command-palette',
            ['Escape', 'Enter', 'ArrowDown', 'ArrowUp'],
            evt => this.handleKey(evt.key)
        );
    }

    protected onClose(): void {
        this._commandList.set([]);
        this._subscription?.unsubscribe();
        this.keybinds.unregisterListener('command-palette');
    }


    fireAction(command?: CommandEntry): void {
        const selected =
            command ?? this._filteredCommandList().find(c => c.isSelected);
        if (!selected) return;
        setTimeout(() => this.bus.publish(
            ActionFired.createFromDefinition(selected.action)
        ));
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
                this.sideMenuService.close();
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
