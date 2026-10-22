import { ShellContextContract } from "@cogno/shared/domain";

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
  readonly timeoutMs?: number;
  /** Written to the process and closed; for a patch to `git apply`, a message to `git credential`. */
  readonly stdin?: string;
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
