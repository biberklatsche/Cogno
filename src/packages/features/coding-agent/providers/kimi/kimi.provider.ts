import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { KIMI_CONFIG, KimiConfig } from "./kimi.config";

@Injectable({ providedIn: "root" })
export class KimiProvider implements ICodingAgentProvider {
  readonly id = KIMI_CONFIG.id;
  readonly name = KIMI_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      KIMI_CONFIG.configFileName,
    );
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const hooks = Array.isArray(config.hooks) ? config.hooks : [];
    return KIMI_CONFIG.hookEvents.every(({ eventName }) =>
      hooks.some((h) => h.event === eventName && KIMI_CONFIG.isCognoCommand(h.command)),
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
        command: buildHookCommand(entry.status, shellType),
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
