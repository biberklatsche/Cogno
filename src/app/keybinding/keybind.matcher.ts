import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";
import {ActionBase, ActionTrigger, validTriggers} from "../app-bus/app-bus";
import {OsType} from "../_tauri/os";

export type KeyCombination = string;

export class KeybindingMatcher {
    private keyCombinationToAction: Record<KeyCombination, ActionBase> = {};
    private keyCodeMapping: KeyboardMapping = {};

    constructor(private _platform: OsType) {
    }

    public initBindings(bindings: string[]) {
        // Einmalig beim Start parsen
        bindings.forEach(binding => {
            const [keybindingDef, actionDef] = binding.split('=');

            const triggers = keybindingDef.split(':');
            const keybinding = triggers.splice(triggers.length - 1, 1);
            const normalized = this.normalizeKeyCombination(keybinding[0]);

            const args = actionDef.split(':');
            const actionName = args.splice(0, 1);

            this.keyCombinationToAction[normalized] =  {type: actionName[0], triggers: this.toTriggers(triggers), args: args};
        });
    }

    private toTriggers(triggers: string[]): ActionTrigger[] {
        return triggers.filter((s: string): s is ActionTrigger => validTriggers.includes(s as ActionTrigger));
    }

    public initKeyCodeMapping(keyCodeMapping: KeyboardMapping) {
        this.keyCodeMapping = keyCodeMapping;
    }

    // Normalisiert die Key-Kombination zu einem eindeutigen String
    private normalizeKeyCombination(keys: string): string {
        const parts = keys.split('+').map(k => k.trim());

        // Sortiere Modifier für Konsistenz (außer der eigentliche Key kommt zuletzt)
        const modifiers = parts.slice(0, -1).sort();
        const key = parts[parts.length - 1];

        return [...modifiers, key].join('+');
    }

    // Erstellt Key-String aus KeyboardEvent
    private eventToKeyString(event: KeyboardEvent): string {
        let parts: string[] = [];
        // Modifier in fester Reihenfolge (alphabetisch sortiert)
        if (event.altKey) parts.push(this._platform === 'macos' ? 'Option' : 'Alt');
        if (event.metaKey) parts.push(this._platform === 'macos' ? 'Command' : 'Meta');
        if (event.ctrlKey) parts.push(this._platform === 'macos' ? 'Control' : 'Ctrl');
        if (event.shiftKey) parts.push('Shift');
        parts = parts.sort();
        // Haupttaste über Mapping normalisieren
        const normalizedKey = this.keyCodeMapping[event.code] || event.key;
        parts.push(normalizedKey);
        return parts.join('+');
    }

    // Hauptmethode: Prüft ob Event ein Keybinding trifft
    match(event: KeyboardEvent): ActionBase | undefined {
        const eventKey = this.eventToKeyString(event);
        return this.keyCombinationToAction[eventKey];
    }
}
