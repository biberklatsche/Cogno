import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";
import {OsType} from "../_tauri/os";
import {KeybindFiredEvent} from "./keybind.service";
import {ActionDefinition, KeybindActionInterpreter} from "./keybind-action.interpreter";
import {ActionName} from "../config/+models/config.types";
import {Modifier} from "./modifier";


type Sequence = { steps: string[]; event: KeybindFiredEvent };

export type Keybinding = string;

export class KeybindingMatcher {
    private sequences: Sequence[] = [];
    private keybindings: Record<string, Keybinding> = {};
    private actions: Record<string, ActionDefinition> = {};
    private keyCodeMapping: KeyboardMapping = {};

    // Laufender Match-Status über mehrere Keydowns
    private currentMatches: { seq: Sequence; index: number }[] = [];

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

            this.actions[action.actionName] = action;
            this.keybindings[action.actionName] = keybindingDef;

            this.sequences.push({
                steps: normalizedSteps,
                event: { type: 'KeybindFired', path: ['app', 'keybind'], payload: action.actionName, trigger: action.trigger, args: action.args }
            });
        });
    }

    getAction(actionName: string): ActionDefinition | undefined {
        return this.actions[actionName];
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

        const modifiers = Modifier.normalizeAll(parts.slice(0, -1));
        const key = parts[parts.length - 1];

        return [...modifiers, key].join('+');
    }

    // Erstellt Key-String aus KeyboardEvent
    private eventToKeyString(event: KeyboardEvent): string {
        let parts: string[] = Modifier.transform(event);
        // Haupttaste über Mapping normalisieren
        const normalizedKey = this.keyCodeMapping[event.code] || event.key;
        parts.push(normalizedKey);
        return parts.join('+');
    }

    // Hauptmethode: Prüft ob Event ein Keybinding trifft (unterstützt Sequenzen)
    match(event: KeyboardEvent): {event: KeybindFiredEvent, eventKey: string} | undefined {
        // Nur auf keydown reagieren, um Doppelzählung zu vermeiden
        if (event.type && event.type !== 'keydown') return undefined;

        const eventKey = this.eventToKeyString(event);

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
            return {event, eventKey: finished.seq.steps.join('>')};
        }

        // 4) Status aktualisieren (nur echte Fortschritte behalten)
        this.currentMatches = progressed;
        return undefined;
    }
}
