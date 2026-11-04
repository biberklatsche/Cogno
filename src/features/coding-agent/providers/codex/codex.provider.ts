import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import {
  AgentSessionEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { Observable } from "rxjs";
import {
  claudeStyleSession,
  interpretClaudeStyleHook,
} from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import { hookCommand, isCognoHookCommand, isCurrentHookCommand } from "../_shared/hook-command";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookMessages$, sessionEvents$, statusTable } from "../_shared/hook-transport";
import { CODEX_CONFIG, CodexHookEntry, CodexHookGroup, CodexHooksFile } from "./codex.config";

/**
 * Codex runs its hooks in a shared background service since 0.157, so a hook
 * carries no terminal: the session is known from `session_id` and `cwd` in
 * the payload (ARCHITECTURE.md 3.2). Codex also runs a changed hook command
 * only after the user trusts it again (`/hooks`); the command written here
 * never changes, only the script behind it.
 */
@Injectable({ providedIn: "root" })
export class CodexProvider implements ICodingAgentProvider {
  readonly id = CODEX_CONFIG.id;
  readonly name = CODEX_CONFIG.name;
  readonly processNames = CODEX_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = sessionEvents$(hookMessages$(ipc, this.id), {
      statusOf: statusTable(CODEX_CONFIG.hookEvents),
      interpret: interpretClaudeStyleHook,
      sessionOf: claudeStyleSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const file = await this.configFile.readJson<CodexHooksFile>(await this.configPath(), {});
    return hookMapState(file.hooks, CODEX_CONFIG.hookEvents, await this.hookFormat());
  }

  /** Codex runs one hook entry on every OS and picks the shell itself, so the install-time shell does not matter. */
  async installHook(): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    file.hooks = withCurrentCognoHooks(
      file.hooks,
      CODEX_CONFIG.hookEvents,
      await this.hookFormat(),
    );
    await this.configFile.writeJson(configPath, file);
    await this.enableHooksInAppConfig();
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    if (!file.hooks) return;
    file.hooks = withoutCognoHooksOnEveryEvent(
      file.hooks,
      (hook) => isCognoHookCommand(hook.command) || isCognoHookCommand(hook.commandWindows),
    );
    await this.configFile.writeJson(configPath, file);
  }

  /** Codex runs `commandWindows` on Windows and `command` elsewhere, so an entry carries both. */
  private async hookFormat(): Promise<HookMapFormat<CodexHookEntry, CodexHookGroup>> {
    const scripts = await this.scripts.get();
    return {
      groupFor: (entry) => ({
        hooks: [
          {
            type: "command",
            command: hookCommand(scripts, "sh", this.id, entry.eventName),
            commandWindows: hookCommand(scripts, "powershell", this.id, entry.eventName),
          },
        ],
      }),
      isCurrent: (hook, entry) =>
        isCurrentHookCommand(hook.command, scripts, this.id, entry.eventName) &&
        isCurrentHookCommand(hook.commandWindows, scripts, this.id, entry.eventName),
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
