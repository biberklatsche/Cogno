import { Injectable } from "@angular/core";
import { CommandRunner } from "@cogno/platform/command-runner";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
} from "@cogno/shared/ports";
import { createPathAdapter } from "../shells/shell-definitions";

@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  constructor(private readonly commandRunner: CommandRunner) {
    super();
  }

  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    try {
      const adapter = createPathAdapter(request.shellContext);
      const normalizedCwd = adapter.normalize(request.cwd);
      const backendPath = adapter.render(normalizedCwd, { purpose: "backend_fs" });
      if (!backendPath) {
        return { stdout: "", stderr: "", exitCode: 1 };
      }

      return await this.commandRunner.execute(
        request.program,
        request.args ?? [],
        backendPath,
        request.timeoutMs,
      );
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }
}
