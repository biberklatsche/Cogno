import {Injectable, signal} from '@angular/core';
import {AppBus} from '../app-bus/app-bus';
import {ActionFired} from '../action/action.models';
import {ConfigService} from '../config/+state/config.service';
import {
    ActionDefinition,
    KeybindInterpreter
} from '../keybinding/keybind-action.interpreter';
import {KeybindService} from "../keybinding/keybind.service";

export type CommandEntry = {
    isSelected: boolean;
    label: string;
    keybinding: string;
    action: ActionDefinition;
}

@Injectable({providedIn: 'root'})
export class CommandPaletteService {
    private _isVisible = signal(false);
    get isVisible(){return  this._isVisible.asReadonly();}
    private _commandList = signal<CommandEntry[]>([]);
    get commandList() { return this._commandList.asReadonly();}

    constructor(private bus: AppBus, private keybinds: KeybindService, config: ConfigService) {
        // Open on ActionFired 'open_command_palette'
        bus.on$(ActionFired.listener()).subscribe((evt) => {
            if (evt.payload === 'open_command_palette') {
                this.open();
            }
        });

        // Build unique action list from configured keybinds
        config.config$.subscribe((c) => {
            const defs: CommandEntry[] = [];
            const seen = new Set<string>();
            for (const line of c.keybind ?? []) {
                const parsed = KeybindInterpreter.parse(line);
                if (!parsed) continue;
                if (seen.has(parsed.actionDefinition.actionName)) continue;
                seen.add(parsed.actionDefinition.actionName);
                defs.push({
                    label: parsed.actionDefinition.actionName.replaceAll('_', ' '),
                    keybinding: parsed.shortcutDefinition.shortcut,
                    action: parsed.actionDefinition,
                    isSelected: false
                });
            }
            defs.sort((a, b) => a.label.localeCompare(b.label));
            defs[0].isSelected = true;
            this._commandList.set(defs);
        });
    }

    open() {
        this.keybinds.registerListener('command-palette', ['Escape', 'ArrowDown', 'ArrowUp'], (keyEvent) => {
            switch (keyEvent.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowDown':
                    this.selectNext(1);
                    break;
                case 'ArrowUp':
                    this.selectNext(-1);
                    break;
            }
        });
        this._isVisible.set(true);
    }

    private selectNext(steps: number) {
        const commands = [...this._commandList()];
        const indexOfSelected = commands.findIndex(s => s.isSelected);
        let nextIndex = (indexOfSelected + steps) % commands.length;
        if(nextIndex < 0) {
            nextIndex = commands.length-1;
        }
        commands[indexOfSelected].isSelected = false;
        commands[nextIndex].isSelected = true;
        this._commandList.set(commands);
    }

    close() {
        this.keybinds.unregisterListener('command-palette');
        this._isVisible.set(false);
    }

    fireAction(command: CommandEntry|undefined = undefined) {
        const selected = command ?? this._commandList().find(s => s.isSelected);
        if (!selected) return;
        this.bus.publish(ActionFired.createFromDefinition(selected.action));
        this.close();
    }

    filter(value: string) {
        
    }
}
