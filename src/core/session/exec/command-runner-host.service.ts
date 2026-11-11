import { Injectable } from "@angular/core";
import {
  CommandRunner as CommandRunnerPort,
  CommandRunnerRequestContract,
  CommandRunnerResultContract,
} from "@cogno/core/api/command-runner-port";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { CommandRunner } from "@cogno/platform/command-runner";
import { createPathAdapter } from "../shells/shell-definitions";

/**
 * Runs commands in the backend. What a run's process asks without a terminal
 * (git credentials, an ssh passphrase, a host key - ARCHITECTURE.md 2.1)
 * goes to the run's own handler; a run without one refuses its prompts.
 */
@Injectable({ providedIn: "root" })
export class CommandRunnerHostService extends CommandRunnerPort {
  constructor(
    private readonly commandRunner: CommandRunner,
    private readonly prompts: ProcessPromptDispatcher,
  ) {
    super();
  }

  async run(request: CommandRunnerRequestContract): Promise<CommandRunnerResultContract> {
    const promptSession = crypto.randomUUID();
    const forgetHandler = request.onPrompt
      ? this.prompts.register(promptSession, request.onPrompt)
      : undefined;
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
        promptSession,
        request.timeoutMs,
        request.stdin,
      );
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    } finally {
      forgetHandler?.();
    }
  }
}
