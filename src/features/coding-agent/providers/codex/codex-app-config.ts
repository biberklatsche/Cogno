/**
 * Codex runs hooks only with `features.hooks = true` in its `config.toml`, a
 * file Codex itself edits in place (trust hashes, project trust). Cogno edits
 * it the same way, by the line, so nothing else in it moves: a re-serialised
 * file would lose comments, key quoting and order.
 */

const TABLE_HEADER = /^\s*\[/;
const FEATURES_HEADER = /^\s*\[\s*features\s*\]\s*(#.*)?$/;
const HOOKS_KEY = /^\s*hooks\s*=/;
const DOTTED_HOOKS_KEY = /^\s*features\.hooks\s*=/;

/** Whether the parsed config has `features.hooks = true`. */
export function featuresHooksEnabled(config: Readonly<Record<string, unknown>>): boolean {
  const features = config["features"];
  return typeof features === "object" && features !== null
    ? (features as Record<string, unknown>)["hooks"] === true
    : false;
}

/**
 * The config text with `features.hooks = true`: an existing `hooks` line in
 * `[features]` (or a top-level `features.hooks`) is replaced, else the key is
 * added to `[features]`, else that table is appended. Line endings stay as
 * they are.
 */
export function withFeaturesHooksEnabled(text: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let table: "top" | "features" | "other" = "top";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (TABLE_HEADER.test(line)) {
      table = FEATURES_HEADER.test(line) ? "features" : "other";
    } else if (table === "top" && DOTTED_HOOKS_KEY.test(line)) {
      lines[i] = "features.hooks = true";
      return lines.join(eol);
    } else if (table === "features" && HOOKS_KEY.test(line)) {
      lines[i] = "hooks = true";
      return lines.join(eol);
    }
  }
  const header = lines.findIndex((line) => FEATURES_HEADER.test(line));
  if (header >= 0) {
    lines.splice(header + 1, 0, "hooks = true");
    return lines.join(eol);
  }
  const body = text.replace(/\s+$/, "");
  return `${body}${body ? eol + eol : ""}[features]${eol}hooks = true${eol}`;
}
