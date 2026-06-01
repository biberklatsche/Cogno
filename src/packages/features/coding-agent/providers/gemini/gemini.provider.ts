import { Injectable } from "@angular/core";
import { BackendOsContract, ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { GEMINI_CONFIG, GeminiSettings } from "./gemini.config";

type CognoManifest = { installedAt: string };

@Injectable({ providedIn: "root" })
export class GeminiProvider implements ICodingAgentProvider {
  readonly id = GEMINI_CONFIG.id;
  readonly name = GEMINI_CONFIG.name;
  readonly processNames = GEMINI_CONFIG.processNames;
  readonly resumeLinkPattern = GEMINI_CONFIG.resumeLinkPattern;

  constructor(private readonly configFile: ConfigFileService) {}

  async isHookInstalled(): Promise<boolean> {
    const manifest = await this.configFile.readJson<CognoManifest | null>(
      await this.manifestPath(),
      null,
    );
    return manifest !== null && "installedAt" in manifest;
  }

  async installHook(platform: BackendOsContract): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configFile.joinPath(configDir, GEMINI_CONFIG.configFileName);
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    settings.hooks = settings.hooks ?? {};
    for (const entry of GEMINI_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, platform);
      const withoutCogno = (settings.hooks[entry.eventName] ?? []).filter(
        (g) => !GEMINI_CONFIG.isCognoCommand(g.command),
      );
      settings.hooks[entry.eventName] = [...withoutCogno, { matcher: "*", command }];
    }
    await this.configFile.writeJson(configPath, settings);
    await this.configFile.writeJson(await this.manifestPath(), {
      installedAt: new Date().toISOString(),
    });
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      GEMINI_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    if (settings.hooks) {
      for (const entry of GEMINI_CONFIG.hookEvents) {
        const cleaned = (settings.hooks[entry.eventName] ?? []).filter(
          (g) => !GEMINI_CONFIG.isCognoCommand(g.command),
        );
        if (cleaned.length === 0) delete settings.hooks[entry.eventName];
        else settings.hooks[entry.eventName] = cleaned;
      }
      await this.configFile.writeJson(configPath, settings);
    }
    await this.configFile.writeJson(await this.manifestPath(), { uninstalled: true });
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), GEMINI_CONFIG.configSubDir);
  }
  private async manifestPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), GEMINI_CONFIG.manifestFileName);
  }
}
