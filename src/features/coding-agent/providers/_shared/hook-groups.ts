/**
 * The hook groups of one event without Cogno's own entries. Claude Code, Gemini
 * and Codex all keep `{ hooks: [...] }` groups per event; installing replaces
 * Cogno's hooks, removing takes them out, and both leave every other hook as
 * it was. A group that is empty afterwards is dropped.
 */
function withoutCognoHooks<TGroup extends { hooks: unknown[] }>(
  groups: ReadonlyArray<TGroup>,
  isCognoHook: (hook: TGroup["hooks"][number]) => boolean,
): TGroup[] {
  return groups
    .map((group) => ({ ...group, hooks: group.hooks.filter((hook) => !isCognoHook(hook)) }))
    .filter((group) => group.hooks.length > 0);
}

/**
 * The hook map without any of Cogno's entries, on every event - including
 * events an older Cogno version hooked and this one no longer does, so neither
 * an update nor a removal leaves a stale Cogno hook behind. Events left without
 * a group are dropped.
 */
export function withoutCognoHooksOnEveryEvent<TGroup extends { hooks: unknown[] }>(
  hooksByEvent: Readonly<Record<string, TGroup[]>>,
  isCognoHook: (hook: TGroup["hooks"][number]) => boolean,
): Record<string, TGroup[]> {
  const cleaned: Record<string, TGroup[]> = {};
  for (const [eventName, groups] of Object.entries(hooksByEvent)) {
    const remaining = withoutCognoHooks(groups, isCognoHook);
    if (remaining.length > 0) cleaned[eventName] = remaining;
  }
  return cleaned;
}
