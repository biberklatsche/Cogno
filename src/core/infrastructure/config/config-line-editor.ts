/**
 * Edits the user's config file line by line: a changed key keeps its line, a
 * new key goes next to its closest relatives, and everything else - comments,
 * blank lines, the order the person chose - stays exactly as it was. The
 * initial writer rewrites the whole file; this one never does.
 */
export class ConfigLineEditor {
  /** The keys the file sets, in order of first appearance. */
  static keys(text: string): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
      const key = ConfigLineEditor.keyOf(line);
      if (key) keys.add(key);
    }
    return keys;
  }

  /**
   * `text` with every entry set; values are already rendered (`true`, `5`,
   * `[a,b]`). `null` removes the key's lines, so the default applies again.
   */
  static set(text: string, entries: Readonly<Record<string, string | null>>): string {
    const lines = text === "" ? [] : text.split(/\r?\n/);
    // A trailing newline leaves an empty last element; it is put back at the end.
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    for (const [key, value] of Object.entries(entries)) {
      if (value === null) ConfigLineEditor.remove(lines, key);
      else ConfigLineEditor.setOne(lines, key, value);
    }

    return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
  }

  private static remove(lines: string[], key: string): void {
    for (let index = lines.length - 1; index >= 0; index--) {
      if (ConfigLineEditor.keyOf(lines[index] ?? "") === key) lines.splice(index, 1);
    }
  }

  private static setOne(lines: string[], key: string, value: string): void {
    const line = `${key} = ${value}`;
    const matches = lines
      .map((candidate, index) => (ConfigLineEditor.keyOf(candidate) === key ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length > 0) {
      // The first occurrence keeps its place; a duplicate further down would
      // override it when read, so it goes.
      lines[matches[0]] = line;
      for (const index of matches.slice(1).reverse()) lines.splice(index, 1);
      return;
    }
    lines.splice(ConfigLineEditor.insertionIndex(lines, key), 0, line);
  }

  /**
   * Right after the last line whose key shares the longest dotted prefix with
   * `key` - `notification.channel.os.enabled` joins the other
   * `notification.channel` lines. Without any relative: the end of the file.
   */
  private static insertionIndex(lines: ReadonlyArray<string>, key: string): number {
    let bestLength = 0;
    let bestIndex = lines.length;
    lines.forEach((candidate, index) => {
      const candidateKey = ConfigLineEditor.keyOf(candidate);
      if (!candidateKey) return;
      const shared = ConfigLineEditor.sharedPrefixLength(candidateKey, key);
      if (shared > 0 && shared >= bestLength) {
        bestLength = shared;
        bestIndex = index + 1;
      }
    });
    return bestIndex;
  }

  /** How many leading dotted segments two keys share. */
  private static sharedPrefixLength(left: string, right: string): number {
    const leftSegments = left.split(".");
    const rightSegments = right.split(".");
    let shared = 0;
    while (
      shared < leftSegments.length &&
      shared < rightSegments.length &&
      leftSegments[shared] === rightSegments[shared]
    ) {
      shared++;
    }
    return shared;
  }

  /** The key of a `key = value` line; null for comments, blanks and anything else. */
  private static keyOf(line: string): string | null {
    const match = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line);
    return match && !line.trim().startsWith("#") ? (match[1] ?? null) : null;
  }
}
