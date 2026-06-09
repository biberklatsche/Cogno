import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import {
  ANTIGRAVITY_CONFIG,
  AntigravityHookDefinition,
  AntigravityHooksFile,
} from "./antigravity.config";

@Injectable({ providedIn: "root" })
export class AntigravityProvider implements ICodingAgentProvider {
  readonly id = ANTIGRAVITY_CONFIG.id;
  readonly name = ANTIGRAVITY_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const hook = (await this.readHooksFile())[ANTIGRAVITY_CONFIG.hookName];
    if (!hook) return false;

    return ANTIGRAVITY_CONFIG.hookEvents.every((entry) => {
      const handlers =
        entry.kind === "tool"
          ? (hook[entry.eventName] ?? []).flatMap((group) => group.hooks)
          : (hook[entry.eventName] ?? []);
      return handlers.some((h) => ANTIGRAVITY_CONFIG.isCognoCommand(h.command));
    });
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configPath();
    const file = await this.readHooksFile();

    const hook: AntigravityHookDefinition = {};
    for (const entry of ANTIGRAVITY_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.stdout);
      if (entry.kind === "tool") {
        hook[entry.eventName] = [{ matcher: entry.matcher, hooks: [{ type: "command", command }] }];
      } else {
        hook[entry.eventName] = [{ type: "command", command }];
      }
    }
    file[ANTIGRAVITY_CONFIG.hookName] = hook;

    await this.configFile.writeJson(configPath, file);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.readHooksFile();
    if (!(ANTIGRAVITY_CONFIG.hookName in file)) return;

    delete file[ANTIGRAVITY_CONFIG.hookName];
    await this.configFile.writeJson(configPath, file);
  }

  private async readHooksFile(): Promise<AntigravityHooksFile> {
    return this.configFile.readJson<AntigravityHooksFile>(await this.configPath(), {});
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(
      await this.configFile.homeDir(),
      ANTIGRAVITY_CONFIG.configSubDir,
    );
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), ANTIGRAVITY_CONFIG.configFileName);
  }
}
