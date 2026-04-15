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

export const KeybindInterpreter = {
  parse(binding: string): KeybindDefinition | undefined {
    const [keybindingDef, actionDef] = binding.split("=");
    if (!keybindingDef || !actionDef) return;

    const action = KeybindActionInterpreter.parse(actionDef);
    // Supports sequences using '>'
    const normalizedSteps = keybindingDef
      .split(">")
      .map((step) => this.normalizeKeyCombination(step.trim()));

    const shortcut = { shortcut: keybindingDef, steps: normalizedSteps };

    return { shortcutDefinition: shortcut, actionDefinition: action };
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
    let trigger: { all: boolean; unconsumed: boolean; performable: boolean } | undefined;
    if (actionDef.includes("[") && actionDef.includes("]")) {
      const triggersList = actionDef
        .substring(actionDef.indexOf("[") + 1, actionDef.lastIndexOf("]"))
        .split(":");
      for (const triggerString of triggersList) {
        if (!trigger) trigger = { all: false, unconsumed: false, performable: false };
        if (!validTriggers.includes(triggerString as ActionTrigger)) continue;
        if (triggerString === "all") {
          trigger.all = true;
        }
        if (triggerString === "performable") {
          trigger.performable = true;
        }
        if (triggerString === "unconsumed") {
          trigger.unconsumed = true;
        }
      }
    }
    const args = actionDef.substring(actionDef.lastIndexOf("]") + 1).split(":");
    const actionName = args.splice(0, 1)[0] as ActionName;
    return { actionName: actionName, trigger: trigger, args: args };
  },
};
