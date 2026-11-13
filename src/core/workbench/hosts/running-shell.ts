import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { SESSION_TOKEN_VARIABLE, SessionInfoContract } from "@cogno/platform";

/** What a session needs to show a shell that already runs. */
export type RunningShell = {
  /** The profile the session works with. */
  readonly profile: ShellProfile;
  /**
   * The secret the shell was started with; left out when its host kept
   * none. The session then makes up one nothing can echo back.
   */
  readonly sessionToken?: string;
};

/**
 * How a session works with a shell that already runs. What kind of shell it
 * is comes from the shell itself, not from what the profile of that name
 * says today; so does its secret.
 *
 * A shell whose host kept no secret for it cannot vouch for what it reports:
 * its integration is not trusted, and the session reads it as a plain shell.
 */
export function runningShell(configured: ShellProfile, running: SessionInfoContract): RunningShell {
  const sessionToken = running.profile.env?.[SESSION_TOKEN_VARIABLE];
  const integration =
    sessionToken !== undefined &&
    (running.profile.enable_shell_integration ?? configured.enable_shell_integration);
  return {
    profile: {
      ...configured,
      shell_type: running.profile.shell_type,
      enable_shell_integration: integration,
    },
    sessionToken,
  };
}
