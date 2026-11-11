import type { HookState } from "../../ports";
import { cognoHookState } from "./hook-command";

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

/**
 * How one agent keeps Cogno's hook in a map of hook groups per event (Claude
 * Code, Gemini, Codex): the group Cogno adds, and how to recognise its hooks.
 */
export interface HookMapFormat<
  TEntry extends { eventName: string },
  TGroup extends { hooks: unknown[] },
> {
  /** The group Cogno adds for an event. */
  groupFor(entry: TEntry): TGroup;
  /** Whether a hook is Cogno's hook for the event as this version writes it. */
  isCurrent(hook: TGroup["hooks"][number], entry: TEntry): boolean;
  /** Whether a hook is Cogno's, of any version. */
  isCogno(hook: TGroup["hooks"][number]): boolean;
}

/** The state of Cogno's hooks in a map of hook groups per event (see `cognoHookState`). */
export function hookMapState<
  TEntry extends { eventName: string },
  TGroup extends { hooks: unknown[] },
>(
  hooksByEvent: Readonly<Record<string, TGroup[]>> | undefined,
  entries: ReadonlyArray<TEntry>,
  format: HookMapFormat<TEntry, TGroup>,
): HookState {
  const cognoHooks = Object.entries(hooksByEvent ?? {}).flatMap(([eventName, groups]) =>
    groups.flatMap((group) =>
      group.hooks.filter((hook) => format.isCogno(hook)).map((hook) => ({ eventName, hook })),
    ),
  );
  return cognoHookState(cognoHooks, entries, format.isCurrent);
}

/** The hook map with Cogno's hooks replaced by this version's, one group per event. */
export function withCurrentCognoHooks<
  TEntry extends { eventName: string },
  TGroup extends { hooks: unknown[] },
>(
  hooksByEvent: Readonly<Record<string, TGroup[]>> | undefined,
  entries: ReadonlyArray<TEntry>,
  format: HookMapFormat<TEntry, TGroup>,
): Record<string, TGroup[]> {
  const hooks = withoutCognoHooksOnEveryEvent(hooksByEvent ?? {}, format.isCogno);
  for (const entry of entries) {
    hooks[entry.eventName] = [...(hooks[entry.eventName] ?? []), format.groupFor(entry)];
  }
  return hooks;
}
