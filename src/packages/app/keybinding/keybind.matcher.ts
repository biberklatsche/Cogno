import {KeyboardMapping} from "./keyboard/keyboard-layouts/_.contribution";
import {
    ActionDefinition,
    KeybindActionInterpreter,
    KeybindDefinition,
    KeybindInterpreter, ShortcutDefinition
} from "./keybind-action.interpreter";
import {Modifier} from "./modifier";
import {ActionFiredEvent, ActionName} from "../action/action.models";
import {ActionFired} from "../action/action.models";


type Sequence = { steps: string[]; event: ActionFiredEvent };


export class KeybindingMatcher {
    private sequences: Sequence[] = [];
    private keybindings: Record<string, ShortcutDefinition> = {};
    private actions: Record<string, ActionDefinition> = {};
    private keyCodeMapping: KeyboardMapping = {};

    // Ongoing match state across multiple keydowns
    private currentMatches: { seq: Sequence; index: number }[] = [];

    public initBindings(bindings: string[]) {
        // Reset and re-parse
        this.sequences = [];
        this.currentMatches = [];
        this.keybindings = {};
        this.actions = {};
        for (const binding of bindings.reverse()) {
            const def = KeybindInterpreter.parse(binding);
            if (!def) return;

            if(this.actions[def.actionDefinition.actionName]) continue;
            this.actions[def.actionDefinition.actionName] = def.actionDefinition;
            this.keybindings[def.actionDefinition.actionName] = def.shortcutDefinition;

            this.sequences.push({
                steps: def.shortcutDefinition.steps,
                event: ActionFired.createFromDefinition(def.actionDefinition)
            });
        }
    }

    getAction(actionName: string): ActionDefinition | undefined {
        return this.actions[actionName];
    }

    getActionNames(): ReadonlyArray<string> {
        return Object.keys(this.actions);
    }

    getKeybinding(actinName: ActionName): string | undefined {
        return this.keybindings[actinName]?.shortcut;
    }

    public initKeyCodeMapping(keyCodeMapping: KeyboardMapping) {
        this.keyCodeMapping = keyCodeMapping;
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


