import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { filter, map, Observable } from "rxjs";
import { AgentStatus } from "../../agent-status";
import { AgentHookEvent, AgentSessionEvent } from "../../ports";
import { CODING_AGENT_HOOK_COMMAND } from "./hook-command";

/** One hook as the script posted it, before the adapter reads the payload. */
export type HookMessage = {
  readonly hookEvent: string;
  /** The terminal from the hook's environment, when it had one. */
  readonly terminalId?: string;
  readonly sentAt: number;
  readonly payload: unknown;
};

/** The hooks of one adapter, as they arrive over Cogno's HTTP server. */
export function hookMessages$(ipc: TerminalIpcPort, providerId: string): Observable<HookMessage> {
  return ipc.messages$.pipe(
    filter((m) => m.command === CODING_AGENT_HOOK_COMMAND && m.args?.[0] === providerId),
    map((m) => ({
      hookEvent: m.args?.[2] ?? "",
      ...(m.terminalId ? { terminalId: m.terminalId } : {}),
      sentAt: Number(m.args?.[1] ?? 0) || 0,
      payload: m.payload,
    })),
  );
}

/** What the adapter reads from a payload about the session it belongs to. */
export type HookSession = {
  readonly sessionId?: string;
  readonly cwd?: string;
};

/**
 * How an adapter turns a hook into a session event: the status each hook
 * event stands for (a hook on an event not listed is not Cogno's and is
 * dropped), what the payload says about the agent, and which session it
 * belongs to. A payload that names no session falls back to the terminal; a
 * hook with neither is dropped, as nothing could be shown for it.
 */
export type HookReading = {
  readonly statusOf: (hookEvent: string) => AgentStatus | undefined;
  /** What the hook says; undefined when it says nothing about the agent (a subagent's inner events, say). */
  readonly interpret: (
    hookEvent: string,
    status: AgentStatus,
    payload: unknown,
  ) => AgentHookEvent | undefined;
  readonly sessionOf: (payload: unknown) => HookSession;
};

export function sessionEvents$(
  messages: Observable<HookMessage>,
  reading: HookReading,
): Observable<AgentSessionEvent> {
  return messages.pipe(
    map((message) => toSessionEvent(message, reading)),
    filter((event): event is AgentSessionEvent => event !== undefined),
  );
}

export function toSessionEvent(
  message: HookMessage,
  reading: HookReading,
): AgentSessionEvent | undefined {
  const status = reading.statusOf(message.hookEvent);
  if (!status) return undefined;
  const session = reading.sessionOf(message.payload);
  const sessionId =
    session.sessionId ?? (message.terminalId ? `terminal:${message.terminalId}` : undefined);
  if (!sessionId) return undefined;
  const event = reading.interpret(message.hookEvent, status, message.payload);
  if (!event) return undefined;
  return {
    sessionId,
    ...(message.terminalId ? { terminalId: message.terminalId } : {}),
    ...(session.cwd ? { cwd: session.cwd } : {}),
    sentAt: message.sentAt,
    event,
  };
}

/** `statusOf` over a table of hooked events. */
export function statusTable(
  entries: ReadonlyArray<{ readonly eventName: string; readonly status: AgentStatus }>,
): (hookEvent: string) => AgentStatus | undefined {
  const byEvent = new Map(entries.map((entry) => [entry.eventName, entry.status]));
  return (hookEvent) => byEvent.get(hookEvent);
}
