import { ShellTypeContract } from "@cogno/shared/domain";

/**
 * Shell profile as a host starts it (wire format, hence the snake_case
 * keys). Structurally identical to the app's configured profile.
 */
export type PtyShellProfileContract = {
  shell_type: ShellTypeContract;
  path?: string;
  args?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  inject_cogno_cli: boolean;
  enable_shell_integration: boolean;
  load_user_rc: boolean;
};

export type TerminalSizeContract = { cols: number; rows: number };

/** Whether a shell ends with the Cogno that started it. */
export type SessionLifetimeContract = "endsWithClient" | "survivesClient";

/** Where a shell sits in the Cogno it belongs to, in that Cogno's words. */
export type SessionPlacementContract = {
  workspace?: string | null;
  tab?: string | null;
  title?: string | null;
  directory?: string | null;
};

/** Which Cogno shows a shell, as the asking one sees it. */
export type AttachedContract =
  | { to: "nowhere" }
  | { to: "here" }
  /** `by` is what the machine of the Cogno that shows it is called, when it said. */
  | { to: "elsewhere"; by: string | null };

/**
 * A shell that runs on a host, as it was started: its profile (whose
 * environment holds the session's token), its size, where it sits and who
 * shows it.
 */
export type SessionInfoContract = {
  terminalId: string;
  placement: SessionPlacementContract;
  profile: PtyShellProfileContract;
  size: TerminalSizeContract;
  attached: AttachedContract;
};

/** The environment variable that carries a session's token to its shell. */
export const SESSION_TOKEN_VARIABLE = "COGNO_SESSION_TOKEN";
