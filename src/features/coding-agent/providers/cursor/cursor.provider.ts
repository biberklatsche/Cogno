import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/features/coding-agent/ports";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommand, isCurrentHookCommand } from "../_shared/hook-command.builder";
import { CURSOR_CONFIG, CursorHooksFile } from "./cursor.config";

/**
 * Cursor's own hooks in `~/.cursor/hooks.json`. Cursor also runs Claude Code's
 * hooks when its third-party imports are on; those report as Claude Code, so a
 * Cursor session gets its own hook and its own name here.
 */
@Injectable({ providedIn: "root" })
export class CursorProvider implements ICodingAgentProvider {
  readonly id = CURSOR_CONFIG.id;
  readonly name = CURSOR_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const file = await this.readHooksFile();
    return CURSOR_CONFIG.hookEvents.every(({ eventName, status }) =>
      (file.hooks?.[eventName] ?? []).some((h) =>
        isCurrentHookCommand(h.command, status, this.id, eventName),
      ),
    );
  }

  async installHook(shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const file = await this.readHooksFile();
    file.version = file.version ?? CURSOR_CONFIG.fileVersion;
    file.hooks = file.hooks ?? {};

    for (const entry of CURSOR_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
      file.hooks[entry.eventName] = [
        ...(file.hooks[entry.eventName] ?? []).filter(
          (h) => !CURSOR_CONFIG.isCognoCommand(h.command),
        ),
        { command },
      ];
    }

    await this.configFile.writeJson(await this.configPath(), file);
  }

  async removeHook(): Promise<void> {
    const file = await this.readHooksFile();
    if (!file.hooks) return;

    for (const entry of CURSOR_CONFIG.hookEvents) {
      const existing = file.hooks[entry.eventName];
      if (!existing) continue;
      const cleaned = existing.filter((h) => !CURSOR_CONFIG.isCognoCommand(h.command));
      if (cleaned.length === 0) {
        delete file.hooks[entry.eventName];
      } else {
        file.hooks[entry.eventName] = cleaned;
      }
    }
    await this.configFile.writeJson(await this.configPath(), file);
  }

  private async readHooksFile(): Promise<CursorHooksFile> {
    return this.configFile.readJson<CursorHooksFile>(await this.configPath(), {});
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), CURSOR_CONFIG.configSubDir);
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CURSOR_CONFIG.configFileName);
  }
}
