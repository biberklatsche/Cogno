import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { interpretClaudeStyleHook } from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommands, isCognoHookCommand } from "../_shared/hook-command.builder";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { CODEX_CONFIG, CodexHookEntry, CodexHookGroup, CodexHooksFile } from "./codex.config";

@Injectable({ providedIn: "root" })
export class CodexProvider implements ICodingAgentProvider {
  readonly id = CODEX_CONFIG.id;
  readonly name = CODEX_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretClaudeStyleHook(hookEvent, status, payload);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const file = await this.configFile.readJson<CodexHooksFile>(await this.configPath(), {});
    return hookMapState(file.hooks, CODEX_CONFIG.hookEvents, this.hookFormat());
  }

  async installHook(_shellType?: string): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    file.hooks = withCurrentCognoHooks(file.hooks, CODEX_CONFIG.hookEvents, this.hookFormat());
    await this.configFile.writeJson(configPath, file);
    await this.enableHooksInAppConfig();
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    if (!file.hooks) return;
    file.hooks = withoutCognoHooksOnEveryEvent(file.hooks, this.hookFormat().isCogno);
    await this.configFile.writeJson(configPath, file);
  }

  /** Codex runs one hook entry on every OS, so it carries both shell variants. */
  private hookFormat(): HookMapFormat<CodexHookEntry, CodexHookGroup> {
    return {
      groupFor: (entry) => ({
        hooks: [{ type: "command", ...buildHookCommands(entry.status, this.id, entry.eventName) }],
      }),
      isCurrent: (hook, entry) => {
        const expected = buildHookCommands(entry.status, this.id, entry.eventName);
        return hook.command === expected.command && hook.commandWindows === expected.commandWindows;
      },
      isCogno: (hook) =>
        isCognoHookCommand(hook.command) || isCognoHookCommand(hook.commandWindows),
    };
  }

  private async enableHooksInAppConfig(): Promise<void> {
    const appConfigPath = await this.configFile.configPath(
      CODEX_CONFIG.configSubDir,
      CODEX_CONFIG.appConfigFileName,
    );
    const cfg = await this.configFile.readToml<Record<string, unknown>>(appConfigPath, {});
    const features = (cfg["features"] ?? {}) as Record<string, unknown>;
    if (features["hooks"] === true) return;
    features["hooks"] = true;
    cfg["features"] = features;
    await this.configFile.writeToml(appConfigPath, cfg);
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(CODEX_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(CODEX_CONFIG.configSubDir, CODEX_CONFIG.configFileName);
  }
}
