import { Injectable } from "@angular/core";
import { BackendOsContract, ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { CODEX_CONFIG, CodexHooks } from "./codex.config";

type CognoManifest = { installedAt: string };

@Injectable({ providedIn: "root" })
export class CodexProvider implements ICodingAgentProvider {
  readonly id = CODEX_CONFIG.id;
  readonly name = CODEX_CONFIG.name;
  readonly processNames = CODEX_CONFIG.processNames;
  readonly resumeLinkPattern = CODEX_CONFIG.resumeLinkPattern;

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
    const configPath = await this.configFile.joinPath(configDir, CODEX_CONFIG.configFileName);
    const hooks = await this.configFile.readJson<CodexHooks>(configPath, {});
    for (const entry of CODEX_CONFIG.hookEvents) {
      hooks[entry.eventName] = {
        type: "command",
        command: buildHookCommand(entry.status, platform),
      };
    }
    await this.configFile.writeJson(configPath, hooks);
    await this.configFile.writeJson(await this.manifestPath(), {
      installedAt: new Date().toISOString(),
    });
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      CODEX_CONFIG.configFileName,
    );
    const hooks = await this.configFile.readJson<CodexHooks>(configPath, {});
    for (const entry of CODEX_CONFIG.hookEvents) {
      const h = hooks[entry.eventName];
      if (h && CODEX_CONFIG.isCognoCommand(h.command)) delete hooks[entry.eventName];
    }
    await this.configFile.writeJson(configPath, hooks);
    await this.configFile.writeJson(await this.manifestPath(), { uninstalled: true });
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), CODEX_CONFIG.configSubDir);
  }
  private async manifestPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CODEX_CONFIG.manifestFileName);
  }
}
