import { AgentStatus } from "@cogno/shared/domain";

/** What a hook payload tells about the agent's work, each field only when present. */
export type HookDetails = {
  /** A new prompt: the task the agent now works on. */
  readonly task?: string;
  /** A tool call, a question to the user or an error message. */
  readonly activity?: string;
  /** The agent's closing message. */
  readonly result?: string;
};

/**
 * A hook as its provider reads it. The transport carries only a status, the
 * event's name and the raw payload; what they mean - which events are subagents,
 * which start a new session, where the prompt sits in the payload - is the
 * provider's knowledge and stays with it.
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
      /** The subagent's id when the provider reports one. */
      readonly agentId?: string;
    };

export interface ICodingAgentProvider {
  readonly id: string;
  readonly name: string;

  isAgentInstalled(): Promise<boolean>;
  isHookInstalled(): Promise<boolean>;
  /** @param shellType The Cogno shell profile type (e.g. "PowerShell", "Bash"). Determines which hook command syntax to write. */
  installHook(shellType?: string): Promise<void>;
  removeHook(): Promise<void>;
  /**
   * Reads one of this provider's hooks. `status` is what the installed hook
   * command reported for `hookEvent`; `payload` is the hook's stdin as JSON, or
   * a marker string when it was omitted.
   */
  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent;
}
