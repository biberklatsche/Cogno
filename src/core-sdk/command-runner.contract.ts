import { InjectionToken } from "@angular/core";
import { ShellContextContract } from "./filesystem.contract";

export interface CommandRunnerRequestContract {
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly program: string;
  readonly args?: ReadonlyArray<string>;
}

export interface CommandRunnerResultContract {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface CommandRunnerContract {
  run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract>;
}

export const commandRunnerToken = new InjectionToken<CommandRunnerContract>("command-runner-token");
