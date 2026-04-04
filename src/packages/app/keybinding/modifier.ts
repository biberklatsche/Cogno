import {OsType} from "@cogno/app-tauri/os";

export const Modifier = {
    modifierOrder: (os: OsType): Record<string, number> => {
        switch (os) {
            case 'macos': return {Ctrl: 1, Alt: 2, Shift: 3, Meta: 4};
            case 'windows':
            case 'linux': return {Ctrl: 1, Alt: 2, Shift: 3, Meta: 4};
        }
    },

    normalize: (modifier: string): string => {
        switch (modifier) {
            case 'Alt':
                return 'Alt';
            case 'Opt':
                return 'Alt';
            case 'Option':
                return 'Alt';
            case 'Meta':
                return 'Meta';
            case 'Super':
                return 'Meta';
            case 'Win':
                return 'Meta';
            case 'Windows':
                return 'Meta';
            case 'Cmd':
                return 'Meta';
            case 'Command':
                return 'Meta';
            case 'Ctrl':
                return 'Ctrl';
            case 'Control':
                return 'Ctrl';
            case 'Shift':
                return 'Shift';
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
        return normalized.map(modifier => {
            switch (os) {
                case "macos":
                    return modifier.replace('Meta', '⌘')
                        .replace('Ctrl', '⌃')
                        .replace('Shift', '⇧')
                        .replace('Alt', '⌥');
                case "windows":
                    return modifier.replace('Meta', 'Win');
                case "linux":
                    return modifier.replace('Meta', 'Super');
                default: return modifier;
            }
        });
    },

    normalizeAll: (modifiers: string[]): string[] => {
        return modifiers.map(m => Modifier.normalize(m)).sort();
    },

    transform: (keyEvent: KeyboardEvent): string[] => {
        const parts: string[] = [];
        if (keyEvent.altKey) parts.push('Alt');
        if (keyEvent.metaKey) parts.push('Meta');
        if (keyEvent.ctrlKey) parts.push('Ctrl');
        if (keyEvent.shiftKey) parts.push('Shift');
        return parts.sort();
    }
}

