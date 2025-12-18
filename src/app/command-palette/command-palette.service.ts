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

export type CommandEntry = {
    isSelected: boolean;
    label: string;
    keybinding: string;
    action: ActionDefinition;
};

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
    private readonly _isVisible = signal(false);
    readonly isVisible = this._isVisible.asReadonly();
    private _subscription: Subscription | undefined;

    private readonly _commandList = signal<CommandEntry[]>([]);
    private readonly _filteredCommandList = signal<CommandEntry[]>([]);
    readonly filteredCommandList = this._filteredCommandList.asReadonly();

    constructor(
        private readonly bus: AppBus,
        private readonly keybinds: KeybindService,
        private readonly config: ConfigService,
        readonly destroyRef: DestroyRef
    ) {
        this.bus.on$(ActionFired.listener()).pipe(takeUntilDestroyed(destroyRef)).subscribe(evt => {
            if (evt.payload === 'open_command_palette') {
                this.open();
            }
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

    open(): void {
        this.initCommands();
        this.initConfigListener();
        this.keybinds.registerListener(
            'command-palette',
            ['Escape', 'Enter', 'ArrowDown', 'ArrowUp'],
            evt => this.handleKey(evt.key)
        );
        this._isVisible.set(true);
    }

    close(): void {
        this._commandList.set([]);
        this._subscription?.unsubscribe();
        this.keybinds.unregisterListener('command-palette');
        this._isVisible.set(false);
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
                this.close();
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
