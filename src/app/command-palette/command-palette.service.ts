import {Injectable, signal} from '@angular/core';
import {AppBus} from '../app-bus/app-bus';
import {ActionFired} from '../action/action.models';
import {ConfigService} from '../config/+state/config.service';
import {
    ActionDefinition,
    KeybindInterpreter
} from '../keybinding/keybind-action.interpreter';

export type CommandEntry = {
    label: string;
    keybinding: string;
    action: ActionDefinition;
}

@Injectable({providedIn: 'root'})
export class CommandPaletteService {
    private _visible = signal(false);
    visible = this._visible.asReadonly();
    private _actions = signal<CommandEntry[]>([]);
    actions = this._actions.asReadonly();

    constructor(private bus: AppBus, config: ConfigService) {
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
                    action: parsed.actionDefinition
                });
            }
            this._actions.set(defs.sort((a, b) => a.label.localeCompare(b.label)));
        });
    }

    open() {
        this._visible.set(true);
    }

    close() {
        this._visible.set(false);
    }

    fire(actionDef: ActionDefinition) {
        this.bus.publish(ActionFired.createFromDefinition(actionDef));
        this.close();
    }
}
