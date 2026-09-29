import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { interpretClaudeStyleHook } from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import {
  buildHookCommand,
  hookStateOf,
  isCurrentHookCommand,
} from "../_shared/hook-command.builder";
import { withoutCognoHooksOnEveryEvent } from "../_shared/hook-groups";
import { editedFilesByTool } from "../_shared/hook-payload";
import { CLAUDE_CODE_CONFIG, ClaudeSettings } from "./claude-code.config";

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
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      CLAUDE_CODE_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    const isCurrent = CLAUDE_CODE_CONFIG.hookEvents.every(({ eventName, status }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => isCurrentHookCommand(h.command, status, this.id, eventName)),
      ),
    );
    const hasCognoHook = Object.values(settings.hooks ?? {}).some((groups) =>
      groups.some((group) => group.hooks.some((h) => CLAUDE_CODE_CONFIG.isCognoCommand(h.command))),
    );
    return hookStateOf(isCurrent, hasCognoHook);
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);

    await this.configFile.ensureDir(configDir);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks ?? {}, (h) =>
      CLAUDE_CODE_CONFIG.isCognoCommand(h.command),
    );

    const shell = shellType === "PowerShell" ? "powershell" : "bash";
    for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
      settings.hooks[entry.eventName] = [
        ...(settings.hooks[entry.eventName] ?? []),
        {
          ...(entry.matcher ? { matcher: entry.matcher } : {}),
          hooks: [{ type: "command", command, shell }],
        },
      ];
    }

    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    if (!settings.hooks) return;

    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, (h) =>
      CLAUDE_CODE_CONFIG.isCognoCommand(h.command),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(
      await this.configFile.homeDir(),
      CLAUDE_CODE_CONFIG.configSubDir,
    );
  }
}
