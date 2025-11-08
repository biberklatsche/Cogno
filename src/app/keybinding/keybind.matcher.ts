import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";
import {OsType} from "../_tauri/os";
import {KeybindFiredEvent} from "./keybind.service";
import {KeybindActionInterpreter} from "./keybind-action.interpreter";
import {ActionName} from "../config/+models/config.types";


type Sequence = { steps: string[]; event: KeybindFiredEvent };

export type Keybinding = string;

export class KeybindingMatcher {
    private sequences: Sequence[] = [];
    private keybindings: Record<string, Keybinding> = {};
    private keyCodeMapping: KeyboardMapping = {};

    // Laufender Match-Status über mehrere Keydowns
    private currentMatches: { seq: Sequence; index: number }[] = [];

    constructor(private _platform: OsType) {
    }

    public initBindings(bindings: string[]) {
        // Reset und neu parsen
        this.sequences = [];
        this.currentMatches = [];
        bindings.reverse().forEach(binding => {
            const [keybindingDef, actionDef] = binding.split('=');
            if (!keybindingDef || !actionDef) return;

            const action = KeybindActionInterpreter.parse(actionDef);
            // Unterstützt Sequenzen mittels '>'
            const normalizedSteps = keybindingDef.split('>').map(step => this.normalizeKeyCombination(step.trim()));

            this.keybindings[action.actionName] = keybindingDef;

            this.sequences.push({
                steps: normalizedSteps,
                event: { type: 'KeybindFired', payload: action.actionName, trigger: action.trigger, args: action.args }
            });
        });
    }

    getKeybinding(actinName: ActionName): string | undefined {
        return this.keybindings[actinName];
    }

    public initKeyCodeMapping(keyCodeMapping: KeyboardMapping) {
        this.keyCodeMapping = keyCodeMapping;
    }

    // Normalisiert die Key-Kombination zu einem eindeutigen String
    private normalizeKeyCombination(keys: string): string {
        const parts = keys.split('+').map(k => k.trim()).filter(Boolean);
        if (parts.length === 0) return '';

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
        const normalizedKey = this.keyCodeMapping[(event as any).code] || (event as any).key;
        parts.push(normalizedKey);
        return parts.join('+');
    }

    // Hauptmethode: Prüft ob Event ein Keybinding trifft (unterstützt Sequenzen)
    match(event: KeyboardEvent): KeybindFiredEvent | undefined {
        // Nur auf keydown reagieren, um Doppelzählung zu vermeiden
        if ((event as any).type && (event as any).type !== 'keydown') return undefined;

        const eventKey = this.eventToKeyString(event);

        console.log('eventKey', eventKey);

        // 1) Laufende Matches fortsetzen
        const progressed: { seq: Sequence; index: number }[] = [];
        for (const m of this.currentMatches) {
            if (m.seq.steps[m.index] === eventKey) {
                progressed.push({ seq: m.seq, index: m.index + 1 });
            }
        }

        // 2) Neue Matches starten (erster Schritt passt)
        for (const seq of this.sequences) {
            if (seq.steps[0] === eventKey) {
                progressed.push({ seq, index: 1 });
            }
        }

        // 3) Prüfen, ob ein Match abgeschlossen ist
        const finished = progressed.find(m => m.index >= m.seq.steps.length);
        if (finished) {
            // Reset nach erfolgreichem Match
            const event = {... finished.seq.event};
            this.currentMatches = [];
            console.log('event', event);
            return event;
        }

        // 4) Status aktualisieren (nur echte Fortschritte behalten)
        this.currentMatches = progressed;
        return undefined;
    }
}
