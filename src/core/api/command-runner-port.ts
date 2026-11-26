import { ShellContextContract } from "@cogno/shared/domain";

/**
 * What a process without a terminal would have asked on one: the ssh git
 * starts for a passphrase or a host key. `text` is the prompt as the process
 * printed it; `closed` fires when the process ended before it got an answer,
 * so an open dialog can go away.
 */
export interface ProcessPromptRequest {
  readonly text: string;
  readonly closed: AbortSignal;
}

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

/**
 * Who answers what the process of one run asks. Each part is optional: a run
 * says which questions it has somebody for, and no other reaches it.
 */
export interface ProcessAnswers {
  /** Answers a prompt; `null` refuses it and the process sees a failed read. Without, every prompt is refused. */
  readonly prompt?: (request: ProcessPromptRequest) => Promise<string | null>;
  /**
   * Answers a credential request of git; `null` refuses it and git fails
   * without asking further. Without, git goes on to its own prompt, which
   * reaches `prompt`.
   */
  readonly credential?: (
    request: ProcessCredentialRequest,
  ) => Promise<ProcessCredentialAnswer | null>;
  /**
   * Git reported the credential it used for `origin` as rejected: the run
   * fails on its access. Called before the run ends, whoever the credential
   * came from.
   */
  readonly credentialRejected?: (origin: string) => void;
}

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
  /**
   * Idle time, not total: the process is ended once it has shown no output
   * and had no question open for this long. A transfer that reports progress
   * runs as long as it takes; a process that went silent is ended.
   */
  readonly timeoutMs?: number;
  /** Written to the process and closed; for a patch to `git apply`, a message to `git credential`. */
  readonly stdin?: string;
  /** Who answers what the process asks; see `ProcessAnswers` for what happens without. */
  readonly answers?: ProcessAnswers;
}

export interface CommandRunnerResultContract {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export abstract class CommandRunner {
  abstract run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract>;
}
