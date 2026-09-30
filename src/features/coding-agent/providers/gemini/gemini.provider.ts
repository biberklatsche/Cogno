import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand, isCurrentHookCommand } from "../_shared/hook-command.builder";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { GEMINI_CONFIG, GeminiHookEntry, GeminiHookGroup, GeminiSettings } from "./gemini.config";
import { interpretGeminiHook } from "./gemini-hook.interpreter";

@Injectable({ providedIn: "root" })
export class GeminiProvider implements ICodingAgentProvider {
  readonly id = GEMINI_CONFIG.id;
  readonly name = GEMINI_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretGeminiHook(hookEvent, status, payload);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const settings = await this.configFile.readJson<GeminiSettings>(await this.configPath(), {});
    return hookMapState(settings.hooks, GEMINI_CONFIG.hookEvents, this.hookFormat());
  }

  async installHook(shellType?: string): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    settings.hooks = withCurrentCognoHooks(
      settings.hooks,
      GEMINI_CONFIG.hookEvents,
      this.hookFormat(shellType),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    if (!settings.hooks) return;
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, this.hookFormat().isCogno);
    await this.configFile.writeJson(configPath, settings);
  }

  private hookFormat(shellType?: string): HookMapFormat<GeminiHookEntry, GeminiHookGroup> {
    return {
      groupFor: (entry) => ({
        hooks: [
          {
            type: "command",
            command: buildHookCommand(entry.status, shellType, this.id, entry.eventName),
          },
        ],
      }),
      isCurrent: (hook, entry) =>
        isCurrentHookCommand(hook.command, entry.status, this.id, entry.eventName),
      isCogno: (hook) => GEMINI_CONFIG.isCognoCommand(hook.command),
    };
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), GEMINI_CONFIG.configSubDir);
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), GEMINI_CONFIG.configFileName);
  }
}
