import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { CLAUDE_CODE_CONFIG, ClaudeSettings, CognoManifest } from "./claude-code.config";

@Injectable({ providedIn: "root" })
export class ClaudeCodeProvider implements ICodingAgentProvider {
  readonly id = CLAUDE_CODE_CONFIG.id;
  readonly name = CLAUDE_CODE_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const configPath = await this.configFile.joinPath(
      await this.configDir(),
      CLAUDE_CODE_CONFIG.configFileName,
    );
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    return CLAUDE_CODE_CONFIG.hookEvents.every(({ eventName }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => CLAUDE_CODE_CONFIG.isCognoCommand(h.command)),
      ),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);
    const manifestPath = await this.manifestPath();

    await this.configFile.ensureDir(configDir);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = settings.hooks ?? {};

    const shell = shellType === "PowerShell" ? "powershell" : "bash";
    for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType);
      const existing = settings.hooks[entry.eventName] ?? [];
      const withoutCogno = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter((h) => !CLAUDE_CODE_CONFIG.isCognoCommand(h.command)),
        }))
        .filter((group) => group.hooks.length > 0);
      settings.hooks[entry.eventName] = [
        ...withoutCogno,
        {
          ...(entry.matcher ? { matcher: entry.matcher } : {}),
          hooks: [{ type: "command", command, shell }],
        },
      ];
    }

    await this.configFile.writeJson(configPath, settings);
    await this.configFile.writeJson(manifestPath, {
      installedAt: new Date().toISOString(),
    } satisfies CognoManifest);
  }

  async removeHook(): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);
    const manifestPath = await this.manifestPath();

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    if (settings.hooks) {
      for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
        const existing = settings.hooks[entry.eventName];
        if (!existing) continue;
        const cleaned = existing
          .map((group) => ({
            ...group,
            hooks: group.hooks.filter((h) => !CLAUDE_CODE_CONFIG.isCognoCommand(h.command)),
          }))
          .filter((group) => group.hooks.length > 0);

        if (cleaned.length === 0) {
          delete settings.hooks[entry.eventName];
        } else {
          settings.hooks[entry.eventName] = cleaned;
        }
      }
      await this.configFile.writeJson(configPath, settings);
    }
    await this.configFile.writeJson(manifestPath, { uninstalled: true });
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(
      await this.configFile.homeDir(),
      CLAUDE_CODE_CONFIG.configSubDir,
    );
  }

  private async manifestPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CLAUDE_CODE_CONFIG.manifestFileName);
  }
}
