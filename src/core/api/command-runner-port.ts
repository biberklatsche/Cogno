import { ShellContextContract } from "@cogno/shared/domain";

/**
 * What a process without a terminal would have asked on one: git for
 * credentials, ssh for a passphrase or a host key. `text` is the prompt as the
 * process printed it; `closed` fires when the process ended before it got an
 * answer, so an open dialog can go away.
 */
export interface ProcessPromptRequest {
  readonly text: string;
  readonly closed: AbortSignal;
}

/** Answers a prompt; `null` refuses it and the process sees a failed read. */
export type ProcessPromptHandler = (prompt: ProcessPromptRequest) => Promise<string | null>;

/**
 * Git needs credentials for `origin` (`https://host[:port]`) and no credential
 * helper had any. `closed` fires when the process ended before it got an
 * answer.
 */
export interface ProcessCredentialRequest {
  readonly origin: string;
  readonly closed: AbortSignal;
}

export type ProcessCredentialAnswer =
  /** The person signed in to the origin (`platform/sign-ins`); the backend hands git the token. */
  | { readonly kind: "signed_in" }
  /** Typed by hand; git gets it as it is. */
  | { readonly kind: "typed"; readonly username: string; readonly password: string };

/** Answers a credential request; `null` refuses it and git fails without asking further. */
export type ProcessCredentialHandler = (
  request: ProcessCredentialRequest,
) => Promise<ProcessCredentialAnswer | null>;

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
  /**
   * Idle time, not total: the process is ended once it has shown no output
   * and had no prompt open for this long. A transfer that reports progress
   * runs as long as it takes; a process that went silent is ended.
   */
  readonly timeoutMs?: number;
  /** Written to the process and closed; for a patch to `git apply`, a message to `git credential`. */
  readonly stdin?: string;
  /** Answers the prompts of this run; without one every prompt is refused. */
  readonly onPrompt?: ProcessPromptHandler;
  /**
   * Answers git's credential requests of this run; without one git goes on to
   * its own prompt, which reaches `onPrompt`.
   */
  readonly onCredential?: ProcessCredentialHandler;
}

export interface CommandRunnerResultContract {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  /**
   * The origin whose credential git reported as rejected: the run failed on
   * its access, whoever the credential came from.
   */
  readonly credentialRejectedFor?: string;
}

export abstract class CommandRunner {
  abstract run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract>;
}
