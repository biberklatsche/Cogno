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
import {Grid} from "../common/grid/grid-calculations";
import {FeatureMode} from "../config/+models/config";
import {SideMenuService} from "../menu/side-menu/+state/side-menu.service";
import {CommandPaletteComponent} from "./command-palette.component";
import {createSideMenuFeature, SideMenuFeature} from "../menu/side-menu/+state/side-menu-feature";

export type CommandEntry = {
    isSelected: boolean;
    label: string;
    keybinding: string;
    action: ActionDefinition;
};

@Injectable({providedIn: 'root'})
export class CommandPaletteService {
    private readonly feature: SideMenuFeature;
    private configSubscription?: Subscription;

    private readonly _commandList = signal<CommandEntry[]>([]);
    private readonly _filteredCommandList = signal<CommandEntry[]>([]);

    readonly filteredCommandList = this._filteredCommandList.asReadonly();

    constructor(
        sideMenuService: SideMenuService,
        private bus: AppBus,
        private config: ConfigService,
        keybinds: KeybindService,
        destroyRef: DestroyRef,
    ) {
        this.feature = createSideMenuFeature(
            {
                label: 'Command Palette',
                icon: 'mdiPaletteSwatch',
                actionName: 'open_command_palette',
                component: CommandPaletteComponent,
                configPath: 'command_palette',
            },
            {
                onModeChange: (mode) => this.handleModeChange(mode),
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
        this.initCommands();
        this.initConfigListener();
        this.filterCommands('');

        this.feature.registerKeybindListener(
            ['Escape', 'Enter', 'ArrowDown', 'ArrowUp'],
            (evt) => this.handleKey(evt.key)
        );
    }

    private handleClose(): void {
        this._commandList.set([]);
        this._filteredCommandList.set([]);
        this.configSubscription?.unsubscribe();
        this.configSubscription = undefined;
        this.feature.unregisterKeybindListener();
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
        this.configSubscription = this.config.config$.subscribe(c => {
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

    private handleKey(key: string): void {
        switch (key) {
            case 'Escape':
                this.feature.close();
                break;
            case 'Enter':
                this.fireAction();
                this.feature.close();
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

    // Public API

    public fireAction(command?: CommandEntry): void {
        const selected = command ?? this._filteredCommandList().find(c => c.isSelected);
        if (!selected) return;

        setTimeout(() => this.bus.publish(
            ActionFired.createFromDefinition(selected.action)
        ));
    }

    public filterCommands(filter: string): void {
        const normalized = filter.toLowerCase();

        const filtered = this._commandList()
            .map(c => ({ ...c, isSelected: false }))
            .filter(c => c.label.toLowerCase().includes(normalized));

        this._filteredCommandList.set(this.selectFirst(filtered));
    }
}