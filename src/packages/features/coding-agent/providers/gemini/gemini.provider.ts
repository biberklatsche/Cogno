import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { GEMINI_CONFIG, GeminiHookGroup, GeminiSettings } from "./gemini.config";

@Injectable({ providedIn: "root" })
export class GeminiProvider implements ICodingAgentProvider {
  readonly id = GEMINI_CONFIG.id;
  readonly name = GEMINI_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      GEMINI_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    return GEMINI_CONFIG.hookEvents.every(({ eventName }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => GEMINI_CONFIG.isCognoCommand(h.command)),
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
      const command = buildHookCommand(entry.status, shellType, this.id);
      const existing: GeminiHookGroup[] = settings.hooks[entry.eventName] ?? [];
      const withoutCogno = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter((h) => !GEMINI_CONFIG.isCognoCommand(h.command)),
        }))
        .filter((group) => group.hooks.length > 0);
      settings.hooks[entry.eventName] = [
        ...withoutCogno,
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
      const cleaned = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter((h) => !GEMINI_CONFIG.isCognoCommand(h.command)),
        }))
        .filter((group) => group.hooks.length > 0);
      if (cleaned.length === 0) delete settings.hooks[eventName];
      else settings.hooks[eventName] = cleaned;
    }

    await this.configFile.writeJson(configPath, settings);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), GEMINI_CONFIG.configSubDir);
  }
}
