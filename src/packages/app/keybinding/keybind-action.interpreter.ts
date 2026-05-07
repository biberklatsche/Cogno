import { ActionName } from "../action/action.models";
import { ActionTrigger, validTriggers } from "../app-bus/app-bus";
import { Modifier } from "./modifier";

export type ActionDefinition = {
  actionName: ActionName;
  trigger?: { all: boolean; unconsumed: boolean; performable: boolean };
  args?: string[];
};
export type ShortcutDefinition = { shortcut: string; steps: string[] };

export type KeybindDefinition = {
  actionDefinition: ActionDefinition;
  shortcutDefinition: ShortcutDefinition;
};

type Trigger = { all: boolean; unconsumed: boolean; performable: boolean };

export const KeybindInterpreter = {
  parse(binding: string): KeybindDefinition | undefined {
    const [keybindingDef, actionDef] = binding.split("=");
    if (!keybindingDef || !actionDef) return;

    const { cleanKeybind, keybindTrigger } = this.parsePrefixes(keybindingDef);
    const action = KeybindActionInterpreter.parse(actionDef);

    if (keybindTrigger) {
      if (!action.trigger) action.trigger = { all: false, unconsumed: false, performable: false };
      if (keybindTrigger.all) action.trigger.all = true;
      if (keybindTrigger.unconsumed) action.trigger.unconsumed = true;
      if (keybindTrigger.performable) action.trigger.performable = true;
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
      const match = remaining.match(/^(all|unconsumed|performable):/);
      if (!match) break;
      if (!trigger) trigger = { all: false, unconsumed: false, performable: false };
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
    let trigger: Trigger | undefined;
    if (actionDef.includes("[") && actionDef.includes("]")) {
      const triggersList = actionDef
        .substring(actionDef.indexOf("[") + 1, actionDef.lastIndexOf("]"))
        .split(":");
      for (const triggerString of triggersList) {
        if (!trigger) trigger = { all: false, unconsumed: false, performable: false };
        if (!validTriggers.includes(triggerString as ActionTrigger)) continue;
        if (triggerString === "all") trigger.all = true;
        if (triggerString === "performable") trigger.performable = true;
        if (triggerString === "unconsumed") trigger.unconsumed = true;
      }
    }
    const args = actionDef.substring(actionDef.lastIndexOf("]") + 1).split(":");
    const actionName = args.splice(0, 1)[0] as ActionName;
    return { actionName, trigger, args };
  },
};
