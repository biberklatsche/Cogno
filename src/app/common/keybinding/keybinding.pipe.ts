import { Pipe, PipeTransform } from '@angular/core';
import {OS} from "../../_tauri/os";

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
