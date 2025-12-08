import { Injectable, signal } from '@angular/core';
import { AppBus } from '../app-bus/app-bus';
import { ActionFired } from '../action/action.models';
import { ConfigService } from '../config/+state/config.service';
import { KeybindActionInterpreter, ActionDefinition } from '../keybinding/keybind-action.interpreter';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private _visible = signal(false);
  visible = this._visible.asReadonly();
  private _actions = signal<ActionDefinition[]>([]);
  actions = this._actions.asReadonly();

  constructor(bus: AppBus, config: ConfigService) {
    // Open on ActionFired 'open_command_palette'
    bus.on$(ActionFired.listener()).subscribe((evt) => {
      if (evt.payload === 'open_command_palette') {
        this.open();
      }
    });

    // Build unique action list from configured keybinds
    config.config$.subscribe((c) => {
      const defs: ActionDefinition[] = [];
      const seen = new Set<string>();
      for (const line of c.keybind ?? []) {
        const parts = line.split('=');
        if (parts.length < 2) continue;
        const actionDefStr = parts.slice(1).join('=');
        const parsed = KeybindActionInterpreter.parse(actionDefStr);
        if (seen.has(parsed.actionName)) continue;
        seen.add(parsed.actionName);
        defs.push(parsed);
      }
      this._actions.set(defs);
    });
  }

  open() {
    this._visible.set(true);
  }

  close() {
    this._visible.set(false);
  }
}
