import { Injectable } from "@angular/core";
import { ICodingAgentProvider } from "@cogno/core-api";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommands } from "../_shared/hook-command.builder";
import { CODEX_CONFIG, CodexHookGroup, CodexHooksFile } from "./codex.config";

@Injectable({ providedIn: "root" })
export class CodexProvider implements ICodingAgentProvider {
  readonly id = CODEX_CONFIG.id;
  readonly name = CODEX_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async isHookInstalled(): Promise<boolean> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    return CODEX_CONFIG.hookEvents.every(({ eventName, status }) => {
      const expected = buildHookCommands(status, this.id, eventName);
      return (file.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some(
          (h) => h.command === expected.command && h.commandWindows === expected.commandWindows,
        ),
      );
    });
  }

  async installHook(_shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});

    file.hooks = file.hooks ?? {};

    for (const entry of CODEX_CONFIG.hookEvents) {
      const { command, commandWindows } = buildHookCommands(entry.status, this.id, entry.eventName);
      const existing: CodexHookGroup[] = file.hooks[entry.eventName] ?? [];
      const withoutCogno = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter(
            (h) => !CODEX_CONFIG.isCognoCommand(h.command, h.commandWindows),
          ),
        }))
        .filter((group) => group.hooks.length > 0);

      file.hooks[entry.eventName] = [
        ...withoutCogno,
        { hooks: [{ type: "command", command, commandWindows }] },
      ];
    }

    await this.configFile.writeJson(configPath, file);
    await this.enableHooksInAppConfig();
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    if (!file.hooks) return;

    for (const { eventName } of CODEX_CONFIG.hookEvents) {
      const existing = file.hooks[eventName];
      if (!existing) continue;
      const cleaned = existing
        .map((group) => ({
          ...group,
          hooks: group.hooks.filter(
            (h) => !CODEX_CONFIG.isCognoCommand(h.command, h.commandWindows),
          ),
        }))
        .filter((group) => group.hooks.length > 0);

      if (cleaned.length === 0) {
        delete file.hooks[eventName];
      } else {
        file.hooks[eventName] = cleaned;
      }
    }

    await this.configFile.writeJson(configPath, file);
  }

  private async enableHooksInAppConfig(): Promise<void> {
    const appConfigPath = await this.configFile.joinPath(
      await this.configDir(),
      CODEX_CONFIG.appConfigFileName,
    );
    const cfg = await this.configFile.readToml<Record<string, unknown>>(appConfigPath, {});
    const features = (cfg["features"] ?? {}) as Record<string, unknown>;
    if (features["hooks"] === true) return;
    features["hooks"] = true;
    cfg["features"] = features;
    await this.configFile.writeToml(appConfigPath, cfg);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), CODEX_CONFIG.configSubDir);
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CODEX_CONFIG.configFileName);
  }
}
