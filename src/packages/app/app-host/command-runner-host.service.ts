import { Injectable } from "@angular/core";
import { CommandRunner } from "@cogno/app-tauri/command-runner";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
} from "@cogno/core-api";
import { PathFactory } from "./path.factory";

@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    try {
      const adapter = PathFactory.createAdapter(request.shellContext);
      const normalizedCwd = adapter.normalize(request.cwd);
      const backendPath = adapter.render(normalizedCwd, { purpose: "backend_fs" });
      if (!backendPath) {
        return { stdout: "", stderr: "", exitCode: 1 };
      }

      return await CommandRunner.execute(
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
