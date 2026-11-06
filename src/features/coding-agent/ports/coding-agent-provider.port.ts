import { Observable } from "rxjs";
import { AgentStatus } from "../agent-status";

/** What a hook payload tells about the agent's work, each field only when present. */
export type HookDetails = {
  /** A new prompt: the task the agent now works on. */
  readonly task?: string;
  /** A tool call, a question to the user or an error message. */
  readonly activity?: string;
  /** The agent's closing message. */
  readonly result?: string;
  /** The model the agent runs on. */
  readonly model?: string;
};

/**
 * What one hook says about the agent, as its adapter read it. Which events
 * are subagents, which start a new session, where the prompt sits in the
 * payload - that is the adapter's knowledge and stays with it.
 */
export type AgentHookEvent =
  | {
      readonly kind: "status";
      readonly status: AgentStatus;
      /** A session began or ended: nothing from before carries over. */
      readonly sessionBoundary: boolean;
      readonly details: HookDetails;
    }
  | {
      readonly kind: "subagent";
      readonly change: "start" | "stop";
      /** The subagent's id when the adapter reports one. */
      readonly agentId?: string;
    }
  | {
      /** The session switched models; says nothing about the agent's status. */
      readonly kind: "model";
      /** The model switched to, when the payload names it. */
      readonly model?: string;
    };

/**
 * One event of an agent's session, keyed by the session the agent itself
 * names (ARCHITECTURE.md 3.2). The terminal is what the hook still knew from
 * its environment, if anything; `cwd` is what the agent reports, so a session
 * without a terminal can still be matched to one.
 */
export type AgentSessionEvent = {
  readonly sessionId: string;
  readonly terminalId?: string;
  readonly cwd?: string;
  /** Unix milliseconds when the hook ran; events apply in this order. 0 when unknown. */
  readonly sentAt: number;
  readonly event: AgentHookEvent;
};

/**
 * Whether Cogno's hook sits in the agent's config: `current` as this version
 * writes it, `outdated` when an older version's Cogno hook is there, `missing`
 * when there is none.
 */
export type HookState = "current" | "outdated" | "missing";

/**
 * An adapter for one coding agent. It owns the agent's config format and its
 * transport: how a hook, a plugin or a protocol turns into `events$` is its
 * business alone, and nothing outside tells agents apart.
 */
export interface ICodingAgentProvider {
  readonly id: string;
  readonly name: string;
  /**
   * The executable names the agent runs under in a terminal (`codex`,
   * `codex.exe`), for matching a session without a terminal to one.
   */
  readonly processNames: ReadonlyArray<string>;
  /** The agent's session events, from whatever transport the adapter uses. */
  readonly events$: Observable<AgentSessionEvent>;
  isAgentInstalled(): Promise<boolean>;
  hookState(): Promise<HookState>;
  /** Installs or updates Cogno's hook; how it reaches Cogno is the adapter's business. */
  installHook(): Promise<void>;
  removeHook(): Promise<void>;
}
