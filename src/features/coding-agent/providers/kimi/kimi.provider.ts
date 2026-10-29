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
  isCognoHookCommand,
  isCurrentHookCommand,
} from "../_shared/hook-command.builder";
import { KIMI_CONFIG, KimiConfig } from "./kimi.config";

@Injectable({ providedIn: "root" })
export class KimiProvider implements ICodingAgentProvider {
  readonly id = KIMI_CONFIG.id;
  readonly name = KIMI_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretClaudeStyleHook(hookEvent, status, payload);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const config = await this.configFile.readToml<KimiConfig>(await this.configPath(), {});
    const hooks = Array.isArray(config.hooks) ? config.hooks : [];
    const isCurrent = KIMI_CONFIG.hookEvents.every(({ eventName, status }) =>
      hooks.some(
        (h) => h.event === eventName && isCurrentHookCommand(h.command, status, this.id, eventName),
      ),
    );
    return hookStateOf(
      isCurrent,
      hooks.some((h) => isCognoHookCommand(h.command)),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const withoutCogno = (Array.isArray(config.hooks) ? config.hooks : []).filter(
      (h) => !isCognoHookCommand(h.command),
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
    const configPath = await this.configPath();
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    if (Array.isArray(config.hooks)) {
      config.hooks = config.hooks.filter((h) => !isCognoHookCommand(h.command));
      await this.configFile.writeToml(configPath, config);
    }
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(KIMI_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(KIMI_CONFIG.configSubDir, KIMI_CONFIG.configFileName);
  }
}
