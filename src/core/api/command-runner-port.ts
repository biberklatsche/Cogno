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

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
  readonly timeoutMs?: number;
  /** Written to the process and closed; for a patch to `git apply`, a message to `git credential`. */
  readonly stdin?: string;
  /** Answers the prompts of this run; without one every prompt is refused. */
  readonly onPrompt?: ProcessPromptHandler;
}

export interface CommandRunnerResultContract {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface CommandRunnerContract {
  run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract>;
}

export abstract class CommandRunner implements CommandRunnerContract {
  abstract run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract>;
}
