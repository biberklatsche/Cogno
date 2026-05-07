import { OsType } from "@cogno/app-tauri/os";

export const Modifier = {
  modifierOrder: (os: OsType): Record<string, number> => {
    switch (os) {
      case "macos":
        return { Ctrl: 1, Alt: 2, Shift: 3, Meta: 4 };
      case "windows":
      case "linux":
        return { Ctrl: 1, Alt: 2, Shift: 3, Meta: 4 };
    }
  },

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
    const modifierOrder = Modifier.modifierOrder(os);
    normalized.sort((a, b) => {
      const orderA = modifierOrder[a] || 999;
      const orderB = modifierOrder[b] || 999;
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
