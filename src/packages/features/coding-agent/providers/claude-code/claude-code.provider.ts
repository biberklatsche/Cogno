import { Injectable } from "@angular/core";
import {
  ApplicationConfigurationPort,
  BackendOsContract,
  ICodingAgentProvider,
} from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand } from "../_shared/hook-command.builder";
import { CLAUDE_CODE_CONFIG, ClaudeSettings, CognoManifest } from "./claude-code.config";

@Injectable({ providedIn: "root" })
export class ClaudeCodeProvider implements ICodingAgentProvider {
  readonly id = CLAUDE_CODE_CONFIG.id;
  readonly name = CLAUDE_CODE_CONFIG.name;
  readonly processNames = CLAUDE_CODE_CONFIG.processNames;

  get resumeLinkPattern(): string | undefined {
    const config = this.configPort.getConfiguration();
    const override = (config as { ai?: { resume_pattern?: string } } | null)?.ai?.resume_pattern;
    return override ?? CLAUDE_CODE_CONFIG.resumeLinkPattern;
  }

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly configPort: ApplicationConfigurationPort,
  ) {}

  async isHookInstalled(): Promise<boolean> {
    const manifestPath = await this.manifestPath();
    const manifest = await this.configFile.readJson<CognoManifest | null>(manifestPath, null);
    return manifest !== null && "installedAt" in manifest;
  }

  async installHook(platform: BackendOsContract): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);
    const manifestPath = await this.manifestPath();

    await this.configFile.ensureDir(configDir);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = settings.hooks ?? {};

    for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, platform);
      const existing = settings.hooks[entry.eventName] ?? [];
      const withoutCogno = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter((h) => !CLAUDE_CODE_CONFIG.isCognoCommand(h.command)),
        }))
        .filter((group) => group.hooks.length > 0);
      settings.hooks[entry.eventName] = [
        ...withoutCogno,
        { hooks: [{ type: "command", command }] },
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
