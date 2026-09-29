import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { ConfigFileService } from "../_shared/config-file.service";
import {
  buildHookCommand,
  hookStateOf,
  isCurrentHookCommand,
} from "../_shared/hook-command.builder";
import { withoutCognoHooksOnEveryEvent } from "../_shared/hook-groups";
import { GEMINI_CONFIG, GeminiHookGroup, GeminiSettings } from "./gemini.config";
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
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      GEMINI_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    const isCurrent = GEMINI_CONFIG.hookEvents.every(({ eventName, status }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => isCurrentHookCommand(h.command, status, this.id, eventName)),
      ),
    );
    const hasCognoHook = Object.values(settings.hooks ?? {}).some((groups) =>
      groups.some((group) => group.hooks.some((h) => GEMINI_CONFIG.isCognoCommand(h.command))),
    );
    return hookStateOf(isCurrent, hasCognoHook);
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configFile.joinPath(configDir, GEMINI_CONFIG.configFileName);
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks ?? {}, (h) =>
      GEMINI_CONFIG.isCognoCommand(h.command),
    );

    for (const entry of GEMINI_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
      const existing: GeminiHookGroup[] = settings.hooks[entry.eventName] ?? [];
      settings.hooks[entry.eventName] = [...existing, { hooks: [{ type: "command", command }] }];
    }

    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      GEMINI_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    if (!settings.hooks) return;

    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, (h) =>
      GEMINI_CONFIG.isCognoCommand(h.command),
    );

    await this.configFile.writeJson(configPath, settings);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), GEMINI_CONFIG.configSubDir);
  }
}
