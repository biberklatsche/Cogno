import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

export type CommandRunnerExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The origin whose credential git reported as rejected during the run. */
  credentialRejectedFor?: string;
};

@Injectable({ providedIn: "root" })
export class CommandRunner {
  /**
   * `stdin`, when given, is written to the process and closed. Prompts the
   * process raises (see `AskpassRequests`) carry `promptSession`.
   */
  execute(
    program: string,
    args: readonly string[],
    cwd: string,
    promptSession: string,
    timeoutMs?: number,
    stdin?: string,
  ): Promise<CommandRunnerExecuteResult> {
    return invoke<CommandRunnerExecuteResult>("command_runner_execute", {
      program,
      args: [...args],
      cwd,
      promptSession,
      timeoutMs,
      stdin,
    });
  }
}
