export type Shortcuts = {
  openDevTools: string;
  showActions: string;
  bringToFront: string;
  showAutocompletion: string;
  changeTab: string;
  nextTab: string;
  previousTab: string;
  newTab: string;
  duplicateTab: string;
  closeTab: string;
  closeOtherTabs: string;
  closeAllTabs: string;
  splitVertical: string;
  splitAndMoveVertical: string;
  splitHorizontal: string;
  splitAndMoveHorizontal: string;
  unsplit: string;
  swapPanes: string;
  copy: string;
  cut: string;
  abortTask: string;
  abortAllTasks: string;
  paste: string;
  showPasteHistory: string;
  find: string;
  clearLine: string;
  clearLineToEnd: string;
  clearLineToStart: string;
  clearBuffer: string;
  deletePreviousWord: string;
  deleteNextWord: string;
  goToNextWord: string;
  goToPreviousWord: string;
  nextArgument: string;
  previousArgument: string;
  openSettings: string;
  openShell1: string;
  openShell2: string;
  openShell3: string;
  openShell4: string;
  openShell5: string;
  openShell6: string;
  openShell7: string;
  openShell8: string;
  openShell9: string;
  showKeytips: string;
  showContextKeytips: string;
  scrollToPreviousCommand: string;
  scrollToNextCommand: string;
  scrollToPreviousBookmark: string;
  scrollToNextBookmark: string;
  selectTextRight: string;
  selectTextLeft: string;
  selectWordRight: string;
  selectWordLeft: string;
  selectTextToEndOfLine: string;
  selectTextToStartOfLine: string;
  injectPassword: string;
  aliases: Alias[];
};

export type ShortcutDefinition = {
  key: string;
  label: string;
  shortcut: string;
  shortcutKeys: string[];
  command?: string;
};

export type ShortcutName = Exclude<keyof Shortcuts, 'aliases'>;

export type Alias = {
  command: string;
  label?: string;
  shortcut: string;
};

export function getShortcutLabel(shortcut: string): string {
  const words = shortcut.split(/(?=[A-Z])/);
  const lowercaseWords = ['in', 'of', 'the', 'other', 'all', 'last', 'to', 'and', 'or', 'with'];
  const correctWords = [];
  for (const word of words) {
    const lowercaseWord = word.toLowerCase();
    if (lowercaseWords.indexOf(lowercaseWord) > -1) {
      correctWords.push(lowercaseWord);
    } else {
      correctWords.push(lowercaseWord.charAt(0).toUpperCase() + lowercaseWord.slice(1));
    }
  }
  return correctWords.join(' ');
}

export function getShortcutKeys(shortcut: string): string[] {
  if(!shortcut){
    return [];
  }
  const keys = shortcut.split('+');
  return keys;
}

export function shortcutsToShortcutsMap(shortcuts: Shortcuts): Map<string, ShortcutDefinition[]> {
  if (!shortcuts) { return new Map<string, ShortcutDefinition[]>(); }
  const array = Object.entries(shortcuts).map(s => {
    if (s[1] instanceof Array) {
      return s[1].map(ss => ({key: toAliasKey(ss.command), command: ss.command, shortcut: ss.shortcut, label: ss.command, shortcutKeys: getShortcutKeys(ss.shortcut)}));
    } else {
      const key = s[0];
      const label = getShortcutLabel(s[0]);
      const shortcut = s[1];
      return {key: key, label: label, shortcut, shortcutKeys: getShortcutKeys(shortcut)};
    }
  }).flat();
  const map = new Map();
  for (const a of array) {
    if(!map.has(a.shortcut)) {
      map.set(a.shortcut, []);
    }
    map.get(a.shortcut).push(a);
  }
  return map;
}

export function toAliasKey(command: string): string {
  return 'alias' + command;
}
