import { Pipe, PipeTransform } from '@angular/core';
import {OS} from "../../_tauri/os";
import {KeybindService} from "../../keybinding/keybind.service";
import {ActionName} from "../../config/+models/config.types";

const modifierOrder: Record<string, number> = {
    Control: 2,
    Command: 5,
    Alt: 3,
    Shift: 4,
    Meta: 1
};

@Pipe({
  name: 'keybinding'
})
export class KeybindingPipe implements PipeTransform {

    transform(keybinding: string | null | undefined): string {
        if (!keybinding) {
            return '';
        }
        let ordered = keybinding.split('+').map(s => s.trim()).sort((a, b) => {
            const orderA = modifierOrder[a] || 999;
            const orderB = modifierOrder[b] || 999;
            return orderA - orderB;
        }).join('+');
        switch (OS.platform()) {
            case 'macos':
                ordered = ordered
                    .replace('Command', '⌘')
                    .replace('Control', '⌃')
                    .replace('Shift', '⇧')
                    .replace('Alt', '⌥')
                    .replace(/\+/g, ' ')
                 break;
            default:
                ordered = ordered.replace('Control', 'Ctrl');
        }
        return ordered;
    }
}

@Pipe({
    name: 'actionkeybinding'
})
export class ActionKeybindingPipe extends KeybindingPipe {

    constructor(private keybindingService: KeybindService) {
        super();
    }

    override transform(action: ActionName | null | undefined): string {
        if (!action) {
            return '';
        }
        const keybinding = this.keybindingService.getKeybinding(action);
        return super.transform(keybinding);
    }
}
