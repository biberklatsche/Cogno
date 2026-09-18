/**
 * The hook groups of one event without Cogno's own entries. Claude Code, Gemini
 * and Codex all keep `{ hooks: [...] }` groups per event; installing replaces
 * Cogno's hooks, removing takes them out, and both leave every other hook as
 * it was. A group that is empty afterwards is dropped.
 */
export function withoutCognoHooks<TGroup extends { hooks: unknown[] }>(
  groups: ReadonlyArray<TGroup>,
  isCognoHook: (hook: TGroup["hooks"][number]) => boolean,
): TGroup[] {
  return groups
    .map((group) => ({ ...group, hooks: group.hooks.filter((hook) => !isCognoHook(hook)) }))
    .filter((group) => group.hooks.length > 0);
}
