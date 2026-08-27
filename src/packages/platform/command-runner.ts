import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export type CommandRunnerExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

@Injectable({ providedIn: "root" })
export class CommandRunner {
  execute(
    program: string,
    args: readonly string[],
    cwd: string,
    timeoutMs?: number,
  ): Promise<CommandRunnerExecuteResult> {
    return invoke<CommandRunnerExecuteResult>("command_runner_execute", {
      program,
      args: [...args],
      cwd,
      timeoutMs,
    });
  }
}
