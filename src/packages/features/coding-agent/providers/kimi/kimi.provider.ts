import { Injectable } from "@angular/core";
import { BackendOsContract, ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { KIMI_CONFIG, KimiConfig } from "./kimi.config";

type CognoManifest = { installedAt: string };

@Injectable({ providedIn: "root" })
export class KimiProvider implements ICodingAgentProvider {
  readonly id = KIMI_CONFIG.id;
  readonly name = KIMI_CONFIG.name;
  readonly processNames = KIMI_CONFIG.processNames;
  readonly resumeLinkPattern = KIMI_CONFIG.resumeLinkPattern;

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
    const configPath = await this.configFile.joinPath(configDir, KIMI_CONFIG.configFileName);
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const withoutCogno = (Array.isArray(config.hooks) ? config.hooks : []).filter(
      (h) => !KIMI_CONFIG.isCognoCommand(h.command),
    );
    config.hooks = [
      ...withoutCogno,
      ...KIMI_CONFIG.hookEvents.map((entry) => ({
        event: entry.eventName,
        command: buildHookCommand(entry.status, platform),
      })),
    ];
    await this.configFile.writeToml(configPath, config);
    await this.configFile.writeJson(await this.manifestPath(), {
      installedAt: new Date().toISOString(),
    });
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
    await this.configFile.writeJson(await this.manifestPath(), { uninstalled: true });
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), KIMI_CONFIG.configSubDir);
  }
  private async manifestPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), KIMI_CONFIG.manifestFileName);
  }
}
