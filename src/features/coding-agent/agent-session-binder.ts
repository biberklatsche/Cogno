import type { TerminalProcess } from "@cogno/core/api/terminal-processes-port";

/**
 * Two agent processes in the same folder are told apart by when they started:
 * the one that started within this long of the session's first event is it.
 */
const START_TIME_TOLERANCE_MS = 60_000;

/** What is known about a session that has no terminal yet. */
export type UnboundSession = {
  readonly cwd?: string;
  /** Unix milliseconds of the session's first event. */
  readonly firstSeenAt: number;
};

export type BindingResult =
  /** Exactly one terminal runs the agent in the session's folder. */
  | { readonly kind: "bound"; readonly terminalId: string }
  /**
   * Several do and their start times do not settle it, or the ones that do
   * already hold a session: shown without a terminal.
   */
  | { readonly kind: "ambiguous" }
  /** None does: the session runs outside Cogno's terminals. */
  | { readonly kind: "none" };

/**
 * Which terminal runs the session (ARCHITECTURE.md 3.2): the agent's process
 * name and the session's folder find the candidates, the start time decides
 * between several. Terminals that already hold a session are no candidates.
 */
export function bindSession(
  processes: ReadonlyArray<TerminalProcess>,
  session: UnboundSession,
  processNames: ReadonlyArray<string>,
  takenTerminals: ReadonlySet<string>,
): BindingResult {
  const running = candidateProcesses(processes, session, processNames);
  if (running.length === 0) return { kind: "none" };
  const candidates = running.filter((process) => !takenTerminals.has(process.terminalId));
  const [only] = candidates;
  if (!only) return { kind: "ambiguous" };
  if (candidates.every((process) => process.terminalId === only.terminalId)) {
    return { kind: "bound", terminalId: only.terminalId };
  }

  const closest = candidates
    .map((process) => ({
      process,
      distance: Math.abs(process.startedAt * 1000 - session.firstSeenAt),
    }))
    .sort((a, b) => a.distance - b.distance);
  const [first, second] = closest;
  if (
    first &&
    first.distance <= START_TIME_TOLERANCE_MS &&
    (!second ||
      second.process.terminalId === first.process.terminalId ||
      second.distance > first.distance)
  ) {
    return { kind: "bound", terminalId: first.process.terminalId };
  }
  return { kind: "ambiguous" };
}

function candidateProcesses(
  processes: ReadonlyArray<TerminalProcess>,
  session: UnboundSession,
  processNames: ReadonlyArray<string>,
): TerminalProcess[] {
  const cwd = session.cwd ? normalizePath(session.cwd) : undefined;
  if (!cwd) return [];
  const names = new Set(processNames.map((name) => name.toLowerCase()));
  return processes.filter(
    (process) =>
      names.has(process.name.toLowerCase()) && !!process.cwd && normalizePath(process.cwd) === cwd,
  );
}

/**
 * Paths as the agent and the OS report them may differ in separators, a
 * trailing separator, Windows' `\\?\` prefix and case; none of that is a
 * different folder.
 */
export function normalizePath(path: string): string {
  return path
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}
