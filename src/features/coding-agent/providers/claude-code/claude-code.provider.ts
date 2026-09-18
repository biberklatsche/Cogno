import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/features/coding-agent/ports";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand, isCurrentHookCommand } from "../_shared/hook-command.builder";
import { withoutCognoHooks } from "../_shared/hook-groups";
import { CLAUDE_CODE_CONFIG, ClaudeSettings } from "./claude-code.config";

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
    return CLAUDE_CODE_CONFIG.hookEvents.every(({ eventName, status }) =>
      (settings.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some((h) => isCurrentHookCommand(h.command, status, this.id, eventName)),
      ),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);

    await this.configFile.ensureDir(configDir);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = settings.hooks ?? {};

    const shell = shellType === "PowerShell" ? "powershell" : "bash";
    for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
      settings.hooks[entry.eventName] = [
        ...withoutCognoHooks(settings.hooks[entry.eventName] ?? [], (h) =>
          CLAUDE_CODE_CONFIG.isCognoCommand(h.command),
        ),
        {
          ...(entry.matcher ? { matcher: entry.matcher } : {}),
          hooks: [{ type: "command", command, shell }],
        },
      ];
    }

    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configDir = await this.configDir();
    const configPath = await this.configFile.joinPath(configDir, CLAUDE_CODE_CONFIG.configFileName);

    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    if (!settings.hooks) return;

    for (const entry of CLAUDE_CODE_CONFIG.hookEvents) {
      const existing = settings.hooks[entry.eventName];
      if (!existing) continue;
      const cleaned = withoutCognoHooks(existing, (h) =>
        CLAUDE_CODE_CONFIG.isCognoCommand(h.command),
      );
      if (cleaned.length === 0) {
        delete settings.hooks[entry.eventName];
      } else {
        settings.hooks[entry.eventName] = cleaned;
      }
    }
    await this.configFile.writeJson(configPath, settings);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(
      await this.configFile.homeDir(),
      CLAUDE_CODE_CONFIG.configSubDir,
    );
  }
}
