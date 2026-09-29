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
import { editedFilesByTool } from "../_shared/hook-payload";
import { KIMI_CONFIG, KimiConfig } from "./kimi.config";

const readEditedFiles = editedFilesByTool(KIMI_CONFIG.editTools);

@Injectable({ providedIn: "root" })
export class KimiProvider implements ICodingAgentProvider {
  readonly id = KIMI_CONFIG.id;
  readonly name = KIMI_CONFIG.name;

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
      KIMI_CONFIG.configFileName,
    );
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const hooks = Array.isArray(config.hooks) ? config.hooks : [];
    const isCurrent = KIMI_CONFIG.hookEvents.every(({ eventName, status }) =>
      hooks.some(
        (h) => h.event === eventName && isCurrentHookCommand(h.command, status, this.id, eventName),
      ),
    );
    return hookStateOf(
      isCurrent,
      hooks.some((h) => KIMI_CONFIG.isCognoCommand(h.command)),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configFile.joinPath(configDir, KIMI_CONFIG.configFileName);
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const withoutCogno = (Array.isArray(config.hooks) ? config.hooks : []).filter(
      (h) => !KIMI_CONFIG.isCognoCommand(h.command),
    );
    config.hooks = [
      ...withoutCogno,
      ...KIMI_CONFIG.hookEvents.map((entry) => ({
        event: entry.eventName,
        command: buildHookCommand(entry.status, shellType, this.id, entry.eventName),
      })),
    ];
    await this.configFile.writeToml(configPath, config);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      KIMI_CONFIG.configFileName,
    );
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    if (Array.isArray(config.hooks)) {
      config.hooks = config.hooks.filter((h) => !KIMI_CONFIG.isCognoCommand(h.command));
      await this.configFile.writeToml(configPath, config);
    }
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), KIMI_CONFIG.configSubDir);
  }
}
