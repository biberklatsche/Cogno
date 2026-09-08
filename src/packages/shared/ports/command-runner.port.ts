// Stays in shared/: dual-consumed by core (api/session/workbench suggestor) and
// features (autocomplete suggestor providers). A contract both layers need
// cannot move to core/api (step 24f).
import { ShellContextContract } from "@cogno/shared/domain";

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
  readonly timeoutMs?: number;
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
