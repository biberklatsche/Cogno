import { Injectable } from "@angular/core";
import { AgentHookEvent, ICodingAgentProvider } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "@cogno/shared/domain";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand, isCurrentHookCommand } from "../_shared/hook-command.builder";
import { withoutCognoHooks } from "../_shared/hook-groups";
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

  async isHookInstalled(): Promise<boolean> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      GEMINI_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    return GEMINI_CONFIG.hookEvents.every(({ eventName, status }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => isCurrentHookCommand(h.command, status, this.id, eventName)),
      ),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configFile.joinPath(configDir, GEMINI_CONFIG.configFileName);
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    settings.hooks = settings.hooks ?? {};

    for (const entry of GEMINI_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
      const existing: GeminiHookGroup[] = settings.hooks[entry.eventName] ?? [];
      settings.hooks[entry.eventName] = [
        ...withoutCognoHooks(existing, (h) => GEMINI_CONFIG.isCognoCommand(h.command)),
        { hooks: [{ type: "command", command }] },
      ];
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

    for (const { eventName } of GEMINI_CONFIG.hookEvents) {
      const existing = settings.hooks[eventName];
      if (!existing) continue;
      const cleaned = withoutCognoHooks(existing, (h) => GEMINI_CONFIG.isCognoCommand(h.command));
      if (cleaned.length === 0) delete settings.hooks[eventName];
      else settings.hooks[eventName] = cleaned;
    }

    await this.configFile.writeJson(configPath, settings);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), GEMINI_CONFIG.configSubDir);
  }
}
