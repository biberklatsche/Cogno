import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { interpretClaudeStyleHook } from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand, isCurrentHookCommand } from "../_shared/hook-command.builder";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { editedFilesByTool } from "../_shared/hook-payload";
import {
  CLAUDE_CODE_CONFIG,
  ClaudeHookEntry,
  ClaudeHookGroup,
  ClaudeSettings,
} from "./claude-code.config";

const readEditedFiles = editedFilesByTool(CLAUDE_CODE_CONFIG.editTools);

@Injectable({ providedIn: "root" })
export class ClaudeCodeProvider implements ICodingAgentProvider {
  readonly id = CLAUDE_CODE_CONFIG.id;
  readonly name = CLAUDE_CODE_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretClaudeStyleHook(hookEvent, status, payload, readEditedFiles);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const settings = await this.configFile.readJson<ClaudeSettings>(await this.configPath(), {});
    return hookMapState(settings.hooks, CLAUDE_CODE_CONFIG.hookEvents, this.hookFormat());
  }

  async installHook(shellType?: string): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = withCurrentCognoHooks(
      settings.hooks,
      CLAUDE_CODE_CONFIG.hookEvents,
      this.hookFormat(shellType),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    if (!settings.hooks) return;
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, this.hookFormat().isCogno);
    await this.configFile.writeJson(configPath, settings);
  }

  private hookFormat(shellType?: string): HookMapFormat<ClaudeHookEntry, ClaudeHookGroup> {
    return {
      groupFor: (entry) => ({
        ...(entry.matcher ? { matcher: entry.matcher } : {}),
        hooks: [
          {
            type: "command",
            command: buildHookCommand(entry.status, shellType, this.id, entry.eventName),
            shell: shellType === "PowerShell" ? "powershell" : "bash",
          },
        ],
      }),
      isCurrent: (hook, entry) =>
        isCurrentHookCommand(hook.command, entry.status, this.id, entry.eventName),
      isCogno: (hook) => CLAUDE_CODE_CONFIG.isCognoCommand(hook.command),
    };
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(
      await this.configFile.homeDir(),
      CLAUDE_CODE_CONFIG.configSubDir,
    );
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CLAUDE_CODE_CONFIG.configFileName);
  }
}
