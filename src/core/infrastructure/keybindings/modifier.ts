import { OsType } from "@cogno/platform/os";

/** The order modifiers are shown in, the same on every platform. */
const MODIFIER_ORDER: Record<string, number> = { Ctrl: 1, Alt: 2, Shift: 3, Meta: 4 };

export const Modifier = {
  normalize: (modifier: string): string => {
    switch (modifier.toLowerCase()) {
      case "alt":
      case "opt":
      case "option":
        return "Alt";
      case "meta":
      case "super":
      case "win":
      case "windows":
      case "cmd":
      case "command":
        return "Meta";
      case "ctrl":
      case "control":
        return "Ctrl";
      case "shift":
        return "Shift";
    }
    return modifier;
  },

  normalizeView: (modifiers: string[], os: OsType): string[] => {
    const normalized = Modifier.normalizeAll(modifiers);
    normalized.sort((a, b) => {
      const orderA = MODIFIER_ORDER[a] || 999;
      const orderB = MODIFIER_ORDER[b] || 999;
      return orderA - orderB;
    });
    return normalized.map((modifier) => {
      switch (os) {
        case "macos":
          return modifier
            .replace("Meta", "⌘")
            .replace("Ctrl", "⌃")
            .replace("Shift", "⇧")
            .replace("Alt", "⌥");
        case "windows":
          return modifier.replace("Meta", "Win");
        case "linux":
          return modifier.replace("Meta", "Super");
        default:
          return modifier;
      }
    });
  },

  normalizeAll: (modifiers: string[]): string[] => {
    return modifiers.map((m) => Modifier.normalize(m)).sort();
  },

  transform: (keyEvent: KeyboardEvent): string[] => {
    const parts: string[] = [];
    if (keyEvent.altKey) parts.push("Alt");
    if (keyEvent.metaKey) parts.push("Meta");
    if (keyEvent.ctrlKey) parts.push("Ctrl");
    if (keyEvent.shiftKey) parts.push("Shift");
    return parts.sort();
  },
};
