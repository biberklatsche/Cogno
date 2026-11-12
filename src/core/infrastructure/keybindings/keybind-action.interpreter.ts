import { Modifier } from "./modifier";

// The action name is the catalogue's identifier (a string). Kept as `string`
// here so the parser stays in infrastructure, which must not import the
// workbench bus where the ActionName alias lives (rule t5).
export type ActionDefinition = {
  actionName: string;
  trigger?: Trigger;
  args?: string[];
};
export type ShortcutDefinition = { shortcut: string; steps: string[] };

export type KeybindDefinition = {
  actionDefinition: ActionDefinition;
  shortcutDefinition: ShortcutDefinition;
};

type Trigger = {
  broadcast: boolean;
  workspace: boolean;
  unconsumed: boolean;
  performable: boolean;
  always: boolean;
};

const noTrigger = (): Trigger => ({
  broadcast: false,
  workspace: false,
  unconsumed: false,
  performable: false,
  always: false,
});

export const KeybindInterpreter = {
  parse(binding: string): KeybindDefinition | undefined {
    // Only the first `=` separates combo and action: an argument may hold more.
    const separatorIndex = binding.indexOf("=");
    if (separatorIndex < 0) return;
    const keybindingDef = binding.slice(0, separatorIndex);
    const actionDef = binding.slice(separatorIndex + 1);
    if (!keybindingDef || !actionDef) return;

    const { cleanKeybind, keybindTrigger } = this.parsePrefixes(keybindingDef);
    const action = KeybindActionInterpreter.parse(actionDef);

    if (keybindTrigger) {
      action.trigger = keybindTrigger;
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
      const match = remaining.match(/^(broadcast|workspace|unconsumed|performable|always):/);
      if (!match) break;
      if (!trigger) trigger = noTrigger();
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
    const actionName = args.splice(0, 1)[0];
    return { actionName, args };
  },
};
