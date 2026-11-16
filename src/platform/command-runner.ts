import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export type CommandRunnerExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

@Injectable({ providedIn: "root" })
export class CommandRunner {
  /**
   * `stdin`, when given, is written to the process and closed. Prompts the
   * process raises (see `AskpassRequests`) carry `promptSession`; unless the
   * caller `answersPrompts`, they are refused without asking anyone.
   */
  execute(
    program: string,
    args: readonly string[],
    cwd: string,
    promptSession: string,
    answersPrompts: boolean,
    timeoutMs?: number,
    stdin?: string,
  ): Promise<CommandRunnerExecuteResult> {
    return invoke<CommandRunnerExecuteResult>("command_runner_execute", {
      program,
      args: [...args],
      cwd,
      promptSession,
      answersPrompts,
      timeoutMs,
      stdin,
    });
  }
}
