import { ActionName } from "../action/action.models";
import { Modifier } from "./modifier";

export type ActionDefinition = {
  actionName: ActionName;
  trigger?: { broadcast: boolean; unconsumed: boolean; performable: boolean; always: boolean };
  args?: string[];
};
export type ShortcutDefinition = { shortcut: string; steps: string[] };

export type KeybindDefinition = {
  actionDefinition: ActionDefinition;
  shortcutDefinition: ShortcutDefinition;
};

type Trigger = { broadcast: boolean; unconsumed: boolean; performable: boolean; always: boolean };

export const KeybindInterpreter = {
  parse(binding: string): KeybindDefinition | undefined {
    const [keybindingDef, actionDef] = binding.split("=");
    if (!keybindingDef || !actionDef) return;

    const { cleanKeybind, keybindTrigger } = this.parsePrefixes(keybindingDef);
    const action = KeybindActionInterpreter.parse(actionDef);

    if (keybindTrigger) {
      if (!action.trigger)
        action.trigger = { broadcast: false, unconsumed: false, performable: false, always: false };
      if (keybindTrigger.broadcast) action.trigger.broadcast = true;
      if (keybindTrigger.unconsumed) action.trigger.unconsumed = true;
      if (keybindTrigger.performable) action.trigger.performable = true;
      if (keybindTrigger.always) action.trigger.always = true;
    }

    // Supports sequences using '>'
    const normalizedSteps = cleanKeybind
      .split(">")
      .map((step) => this.normalizeKeyCombination(step.trim()));

    return {
      shortcutDefinition: { shortcut: cleanKeybind, steps: normalizedSteps },
      actionDefinition: action,
    };
  },

  parsePrefixes(keybind: string): { cleanKeybind: string; keybindTrigger?: Trigger } {
    let remaining = keybind;
    let trigger: Trigger | undefined;

    for (;;) {
      const match = remaining.match(/^(broadcast|unconsumed|performable|always):/);
      if (!match) break;
      if (!trigger)
        trigger = { broadcast: false, unconsumed: false, performable: false, always: false };
      trigger[match[1] as keyof Trigger] = true;
      remaining = remaining.slice(match[0].length);
    }

    return { cleanKeybind: remaining, keybindTrigger: trigger };
  },

  // Normalizes the key combination to a unique string
  normalizeKeyCombination(keys: string): string {
    const parts = keys
      .split("+")
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return "";

    const modifiers = Modifier.normalizeAll(parts.slice(0, -1));
    const key = parts[parts.length - 1];

    return [...modifiers, key].join("+");
  },
};

export const KeybindActionInterpreter = {
  parse(actionDef: string): ActionDefinition {
    const args = actionDef.split(":");
    const actionName = args.splice(0, 1)[0] as ActionName;
    return { actionName, args };
  },
};
