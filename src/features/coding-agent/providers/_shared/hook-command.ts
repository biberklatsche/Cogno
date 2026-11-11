import type { HookState } from "../../ports";

/** The message an agent hook arrives as (`core/api` TerminalIpcPort). */
export const CODING_AGENT_HOOK_COMMAND = "coding_agent_hook";

/** Where Cogno keeps its hook scripts, one per shell (ARCHITECTURE.md 3.2). */
export type HookScriptPaths = {
  readonly bash: string;
  readonly powershell: string;
};

/** The shell an agent's hook command runs the script with. */
export type HookShell = "sh" | "powershell" | "pwsh";

const HOOK_SHELLS: ReadonlyArray<HookShell> = ["sh", "powershell", "pwsh"];

/** The marker every command of Cogno's carries, in this and earlier versions. */
const SCRIPT_STEM = "cogno-agent-hook";
const LEGACY_MARKERS = ["COGNO_PORT", "coding_agent_status"] as const;

/**
 * The command an agent's config holds for one of Cogno's hooks: the stable
 * script with provider and event as arguments. Nothing in it changes with
 * the protocol, so an agent that gates changed hook commands (Codex) keeps
 * running it. `stdout` is what the hook must print for agents whose hooks
 * answer with JSON (Antigravity); the script itself prints nothing.
 */
export function hookCommand(
  scripts: HookScriptPaths,
  shell: HookShell,
  providerId: string,
  hookEvent: string,
  stdout?: string,
): string {
  if (shell === "sh") {
    const run = `sh "${scripts.bash.replace(/\\/g, "/")}" ${providerId} ${hookEvent}`;
    return stdout ? `${run}; echo '${stdout}'` : run;
  }
  const run = `${shell} -NoProfile -ExecutionPolicy Bypass -File "${scripts.powershell}" ${providerId} ${hookEvent}`;
  return stdout ? `${run}; Write-Output '${stdout}'` : run;
}

/**
 * Whether a command on disk is this version's for the event, in any shell:
 * the install-time shell is not persisted, so every variant counts.
 */
export function isCurrentHookCommand(
  command: string | undefined,
  scripts: HookScriptPaths,
  providerId: string,
  hookEvent: string,
  stdout?: string,
): boolean {
  if (!command) return false;
  return HOOK_SHELLS.some(
    (shell) => command === hookCommand(scripts, shell, providerId, hookEvent, stdout),
  );
}

/** Whether a command on disk is one of Cogno's, from whatever version wrote it. */
export function isCognoHookCommand(command: string | undefined): boolean {
  if (!command) return false;
  return (
    command.includes(SCRIPT_STEM) || LEGACY_MARKERS.every((marker) => command.includes(marker))
  );
}

/** Whether a hook that names its command in `command` is one of Cogno's. */
export function hasCognoCommand(hook: { command?: string }): boolean {
  return isCognoHookCommand(hook.command);
}

/**
 * The state of Cogno's hooks found in an agent's config, by the event each
 * hangs on. Current when there is exactly this version's hook for every event
 * and no other Cogno hook (an older version's, or another instance's, would
 * run twice); outdated when Cogno hooks are there but not exactly these.
 */
export function cognoHookState<THook, TEntry extends { eventName: string }>(
  cognoHooks: ReadonlyArray<{ eventName: string; hook: THook }>,
  entries: ReadonlyArray<TEntry>,
  isCurrent: (hook: THook, entry: TEntry) => boolean,
): HookState {
  if (cognoHooks.length === 0) return "missing";
  const exactlyCurrent =
    cognoHooks.length === entries.length &&
    entries.every((entry) =>
      cognoHooks.some(
        ({ eventName, hook }) => eventName === entry.eventName && isCurrent(hook, entry),
      ),
    );
  return exactlyCurrent ? "current" : "outdated";
}
