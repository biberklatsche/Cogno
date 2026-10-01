import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/features/coding-agent/ports";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildOpenCodePlugin, OPENCODE_CONFIG } from "./opencode.config";

/**
 * Cogno's OpenCode plugin: one file of Cogno's own, so installing writes it,
 * removing deletes it, and nothing of the user's is ever touched. The shell
 * type plays no part; the plugin runs inside OpenCode on every platform.
 */
@Injectable({ providedIn: "root" })
export class OpenCodeProvider implements ICodingAgentProvider {
  readonly id = OPENCODE_CONFIG.id;
  readonly name = OPENCODE_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const current = await this.configFile.readText(await this.pluginPath());
    return current === buildOpenCodePlugin();
  }

  async installHook(): Promise<void> {
    await this.configFile.ensureDir(await this.pluginsDir());
    await this.configFile.writeText(await this.pluginPath(), buildOpenCodePlugin());
  }

  async removeHook(): Promise<void> {
    await this.configFile.remove(await this.pluginPath());
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), OPENCODE_CONFIG.configSubDir);
  }

  private async pluginsDir(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), OPENCODE_CONFIG.pluginsSubDir);
  }

  private async pluginPath(): Promise<string> {
    return this.configFile.joinPath(await this.pluginsDir(), OPENCODE_CONFIG.pluginFileName);
  }
}
