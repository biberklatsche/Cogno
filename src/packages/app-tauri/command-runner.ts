import { invoke } from "@tauri-apps/api/core";

export type CommandRunnerExecuteResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export const CommandRunner = {
  execute(
    program: string,
    args: readonly string[],
    cwd: string,
  ): Promise<CommandRunnerExecuteResult> {
    return invoke<CommandRunnerExecuteResult>("command_runner_execute", {
      program,
      args: [...args],
      cwd,
    });
  },
};
