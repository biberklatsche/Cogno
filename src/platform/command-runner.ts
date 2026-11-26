import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { RunQuestionKind } from "./run-questions";

export type CommandRunnerExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

@Injectable({ providedIn: "root" })
export class CommandRunner {
  /**
   * `stdin`, when given, is written to the process and closed. What the
   * process asks (see `RunQuestions`) carries `promptSession`; `answers`
   * names the kinds of question the caller has somebody for, and no other
   * kind reaches the window.
   */
  execute(
    program: string,
    args: readonly string[],
    cwd: string,
    promptSession: string,
    answers: ReadonlyArray<RunQuestionKind>,
    timeoutMs?: number,
    stdin?: string,
  ): Promise<CommandRunnerExecuteResult> {
    return invoke<CommandRunnerExecuteResult>("command_runner_execute", {
      program,
      args: [...args],
      cwd,
      promptSession,
      answers: [...answers],
      timeoutMs,
      stdin,
    });
  }
}
