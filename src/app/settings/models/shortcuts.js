"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortcutsArrayToShortcuts = shortcutsArrayToShortcuts;
exports.getShortcutLabel = getShortcutLabel;
exports.getShortcutKeys = getShortcutKeys;
exports.shortcutsToShortcutsMap = shortcutsToShortcutsMap;
exports.toAliasKey = toAliasKey;
function shortcutsArrayToShortcuts(shortcuts) {
    const o = {};
    o.aliases = [];
    for (const shortcut of shortcuts) {
        if (shortcut.command) { // alias
            o.aliases.push({ command: shortcut.command, shortcut: shortcut.shortcut });
        }
        else {
            o[shortcut.key] = shortcut.shortcut;
        }
    }
    return o;
}
function getShortcutLabel(shortcut) {
    const words = shortcut.split(/(?=[A-Z])/);
    const lowercaseWords = ['in', 'of', 'the', 'other', 'all', 'last', 'to', 'and', 'or', 'with'];
    const correctWords = [];
    for (const word of words) {
        const lowercaseWord = word.toLowerCase();
        if (lowercaseWords.indexOf(lowercaseWord) > -1) {
            correctWords.push(lowercaseWord);
        }
        else {
            correctWords.push(lowercaseWord.charAt(0).toUpperCase() + lowercaseWord.slice(1));
        }
    }
    return correctWords.join(' ');
}
/*export function toShortcutString(e: KeyboardEvent, foreCommandOrControl: boolean = false): string {
  if (e == null) {
    return '';
  }
  const parts = [];
  if(foreCommandOrControl) {
    if (e.ctrlKey || e.metaKey) {
      parts.push('CommandOrControl');
    }
  } else {
    if (e.ctrlKey) {
      parts.push('Control');
    }
    if (e.metaKey) {
      parts.push('Command');
    }
  }
  if (e.altKey) {
    parts.push('Alt');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.code === 'Space') {
    parts.push('Space');
  } else if (e.code ===  'Tab') {
    parts.push('Tab');
  } else if (e.code === 'Home') {
    parts.push('Home');
  } else if (e.code === 'End') {
    parts.push('End');
  } else if (e.code === 'PageUp') {
    parts.push('PageUp');
  } else if (e.code === 'PageDown') {
    parts.push('PageDown');
  } else if (e.code === 'Insert') {
    parts.push('Insert');
  } else if (e.code === 'Delete') {
    parts.push('Delete');
  } else if (e.code === 'Period') {
    parts.push('.');
  } else if (e.code === 'Comma') {
    parts.push(',');
  } else if (e.code === 'Semicolon' && e.key === 'ö') {
    parts.push('Ö');
  } else if (e.code === 'Semicolon') {
    parts.push(';');
  } else if (e.code === 'Quote' && e.key === 'ä') {
    parts.push('Ä');
  } else if (e.code === 'Quote') {
    parts.push('\\');
  } else if (e.code === 'BracketLeft' && e.key === 'ü') {
    parts.push('Ü');
  } else if (e.code === 'BracketLeft') {
    parts.push('[');
  } else if (e.code === 'BracketRight' && (e.key === '+' || e.key === '*' || e.key === '~')) {
    parts.push('+');
  } else if (e.code === 'BracketRight') {
    parts.push(']');
  } else if (e.code === 'ArrowLeft') {
    parts.push('Left');
  } else if (e.code === 'ArrowRight') {
    parts.push('Right');
  }else if (e.code === 'ArrowUp') {
    parts.push('Up');
  } else if (e.code === 'ArrowDown') {
    parts.push('Down');
  } else if (e.code.startsWith('Numpad')) {
    parts.push(e.code.replace('Numpad', ''));
  } else if (e.code === 'Backquote') {
    parts.push('^');
  } else if (e.code === 'IntlBackslash') {
    parts.push('>');
  } else if (e.code === 'Slash') {
    parts.push('_');
  } else if (e.code.startsWith('F')) {
    parts.push(e.code);
  } else if (e.code.startsWith('Digit')) {
    parts.push(e.code.replace('Digit', ''));
  } else if (e.code.startsWith('Key')) {
    parts.push(e.key.toUpperCase());
  }
  return parts.join('+');
}*/
function getShortcutKeys(shortcut) {
    if (!shortcut) {
        return [];
    }
    const keys = shortcut.split('+');
    return keys;
}
function shortcutsToShortcutsMap(shortcuts) {
    if (!shortcuts) {
        return new Map();
    }
    const array = Object.entries(shortcuts).map(s => {
        if (s[1] instanceof Array) {
            return s[1].map(ss => ({ key: toAliasKey(ss.command), command: ss.command, shortcut: ss.shortcut, label: ss.command, shortcutKeys: getShortcutKeys(ss.shortcut) }));
        }
        else {
            const key = s[0];
            const label = getShortcutLabel(s[0]);
            const shortcut = s[1];
            return { key: key, label: label, shortcut, shortcutKeys: getShortcutKeys(shortcut) };
        }
    }).flat();
    const map = new Map();
    for (const a of array) {
        if (!map.has(a.shortcut)) {
            map.set(a.shortcut, []);
        }
        map.get(a.shortcut).push(a);
    }
    return map;
}
function toAliasKey(command) {
    return 'alias' + command;
}
