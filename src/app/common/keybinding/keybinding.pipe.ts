import { Pipe, PipeTransform } from '@angular/core';
import {OS} from "../../_tauri/os";
import {KeybindService} from "../../keybinding/keybind.service";
import {ActionName} from "../../config/+models/config";

@Pipe({
  name: 'keybinding'
})
export class KeybindingPipe implements PipeTransform {

    transform(keybinding: string | null | undefined): string {
        if (!keybinding) {
            return '';
        }
        switch (OS.platform()) {
            case 'macos':
                return keybinding
                    .replace('Command', '⌘')
                    .replace('Control', '⌃')
                    .replace('Alt', '⌥');
            default:
                return keybinding.replace('Control', 'Ctrl');
        }
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
