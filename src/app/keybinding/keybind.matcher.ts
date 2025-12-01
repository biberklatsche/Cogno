import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";
import {ActionDefinition, KeybindActionInterpreter} from "./keybind-action.interpreter";
import {Modifier} from "./modifier";
import {ActionFiredEvent, ActionName} from "../action/action.models";
import {ActionFired} from "../action/action.models";


type Sequence = { steps: string[]; event: ActionFiredEvent };

export type Keybinding = string;

export class KeybindingMatcher {
    private sequences: Sequence[] = [];
    private keybindings: Record<string, Keybinding> = {};
    private actions: Record<string, ActionDefinition> = {};
    private keyCodeMapping: KeyboardMapping = {};

    // Ongoing match state across multiple keydowns
    private currentMatches: { seq: Sequence; index: number }[] = [];

    public initBindings(bindings: string[]) {
        // Reset and re-parse
        this.sequences = [];
        this.currentMatches = [];
        for (const binding of bindings.reverse()) {
            const [keybindingDef, actionDef] = binding.split('=');
            if (!keybindingDef || !actionDef) return;

            const action = KeybindActionInterpreter.parse(actionDef);
            // Supports sequences using '>'
            const normalizedSteps = keybindingDef.split('>').map(step => this.normalizeKeyCombination(step.trim()));

            if(this.actions[action.actionName]) continue;
            this.actions[action.actionName] = action;
            this.keybindings[action.actionName] = keybindingDef;

            this.sequences.push({
                steps: normalizedSteps,
                event: ActionFired.create(action.actionName, action.trigger, action.args)
            });
        }
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

    // Normalizes the key combination to a unique string
    private normalizeKeyCombination(keys: string): string {
        const parts = keys.split('+').map(k => k.trim()).filter(Boolean);
        if (parts.length === 0) return '';

        const modifiers = Modifier.normalizeAll(parts.slice(0, -1));
        const key = parts[parts.length - 1];

        return [...modifiers, key].join('+');
    }

    // Creates a key string from a KeyboardEvent
    private eventToKeyString(event: KeyboardEvent): string {
        let parts: string[] = Modifier.transform(event);
        // Normalize the primary key via mapping
        const normalizedKey = this.keyCodeMapping[event.code] || event.key;
        parts.push(normalizedKey);
        return parts.join('+');
    }

    // Main method: checks whether the event matches a keybinding (supports sequences)
    match(event: KeyboardEvent): {event: ActionFiredEvent, eventKey: string} | undefined {
        // React only to keydown to avoid double counting
        if (event.type && event.type !== 'keydown') return undefined;

        const eventKey = this.eventToKeyString(event);

        // 1) Continue ongoing matches
        const progressed: { seq: Sequence; index: number }[] = [];
        for (const m of this.currentMatches) {
            if (m.seq.steps[m.index] === eventKey) {
                progressed.push({ seq: m.seq, index: m.index + 1 });
            }
        }

        // 2) Start new matches (first step matches)
        for (const seq of this.sequences) {
            if (seq.steps[0] === eventKey) {
                progressed.push({ seq, index: 1 });
            }
        }

        // 3) Check whether a match is completed
        const finished = progressed.find(m => m.index >= m.seq.steps.length);
        if (finished) {
            // Reset after a successful match
            const event = {... finished.seq.event};
            this.currentMatches = [];
            return {event, eventKey: finished.seq.steps.join('>')};
        }

        // 4) Update status (keep only real progress)
        this.currentMatches = progressed;
        return undefined;
    }
}
