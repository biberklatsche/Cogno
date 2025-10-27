import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";

export type KeyCombination = string;
export type ActionName = string;

export class KeybindingMatcher {
    private bindingMap: Record<KeyCombination, ActionName> = {};
    private keyCodeMapping: KeyboardMapping = {};

    public initBindings(bindings: string[]) {
        // Einmalig beim Start parsen
        bindings.forEach(binding => {
            const [keybinding, action] = binding.split(':');
            const normalized = this.normalizeKeyCombination(keybinding);
            this.bindingMap[normalized] = action;
        });
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
        const parts: string[] = [];
        // Modifier in fester Reihenfolge (wie in deinen Bindings)
        if (event.metaKey || event.metaKey) parts.push('Command');
        if (event.ctrlKey) parts.push('Control');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        // Haupttaste über Mapping normalisieren
        const normalizedKey = this.keyCodeMapping[event.code] || event.key;
        parts.push(normalizedKey);
        return parts.join('+');
    }

    // Hauptmethode: Prüft ob Event ein Keybinding trifft
    match(event: KeyboardEvent): ActionName | undefined {
        const eventKey = this.eventToKeyString(event);
        console.log('eventKey', eventKey, this.bindingMap);
        return this.bindingMap[eventKey];
    }
}