import { Injectable } from "@angular/core";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
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
import { hookSessionEvents$ } from "../_shared/hook-transport";
import { CODEX_CONFIG, CodexHookEntry, CodexHookGroup, CodexHooksFile } from "./codex.config";
import { featuresHooksEnabled, withFeaturesHooksEnabled } from "./codex-app-config";

type CodexHook = CodexHookGroup["hooks"][number];

/** Codex runs `commandWindows` on Windows and `command` elsewhere: either may be Cogno's. */
function isCognoCodexHook(hook: CodexHook): boolean {
  return isCognoHookCommand(hook.command) || isCognoHookCommand(hook.commandWindows);
}

/**
 * Codex runs its hooks in a shared background service since 0.157. The hook
 * still gets the environment of the Codex session that fired it (0.166), so
 * the terminal usually comes along; the session is keyed by `session_id` and
 * `cwd` from the payload either way (ARCHITECTURE.md 3.2). Subagents report
 * under the parent's `session_id` with their own `agent_id`.
 *
 * Codex runs a changed hook command only after the user trusts it again
 * (`/hooks`): the command written here never changes, only the script behind
 * it, and the user is told whenever the hooks file did change.
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
    private readonly notifications: NotificationCenterPort,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = hookSessionEvents$(ipc, this.id, {
      hookEvents: CODEX_CONFIG.hookEvents,
      interpret: interpretClaudeStyleHook,
      sessionOf: claudeStyleSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  /** Current only when Codex also has hooks switched on; installing switches them on. */
  async hookState(): Promise<HookState> {
    const file = await this.configFile.readJson<CodexHooksFile>(await this.configPath(), {});
    const state = hookMapState(file.hooks, CODEX_CONFIG.hookEvents, await this.hookFormat());
    if (state !== "current") return state;
    return (await this.hooksEnabledInAppConfig()) ? "current" : "outdated";
  }

  /** Codex runs one hook entry on every OS and picks the shell itself, so the install-time shell does not matter. */
  async installHook(): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    const before = JSON.stringify(file.hooks ?? {});
    file.hooks = withCurrentCognoHooks(
      file.hooks,
      CODEX_CONFIG.hookEvents,
      await this.hookFormat(),
    );
    const changed = JSON.stringify(file.hooks) !== before;
    if (changed) await this.configFile.writeJson(configPath, file);
    await this.enableHooksInAppConfig();
    if (changed) this.askForTrust();
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    if (!file.hooks) return;
    file.hooks = withoutCognoHooksOnEveryEvent(file.hooks, isCognoCodexHook);
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
      isCogno: isCognoCodexHook,
    };
  }

  private async hooksEnabledInAppConfig(): Promise<boolean> {
    const config = await this.configFile.readToml<Record<string, unknown>>(
      await this.appConfigPath(),
      {},
    );
    return featuresHooksEnabled(config);
  }

  /** Switches `features.hooks` on by editing the line, so the rest of the file stays as Codex wrote it. */
  private async enableHooksInAppConfig(): Promise<void> {
    if (await this.hooksEnabledInAppConfig()) return;
    const path = await this.appConfigPath();
    const text = (await this.configFile.readText(path)) ?? "";
    await this.configFile.replaceText(path, withFeaturesHooksEnabled(text));
  }

  /** A changed hooks file runs only once the user trusts it in Codex. */
  private askForTrust(): void {
    this.notifications.dispatch({
      header: `${this.name} hook changed`,
      body: `${this.name} runs a changed hook only after you trust it: run /hooks in ${this.name} and approve the Cogno hooks.`,
      type: "info",
      timestamp: new Date(),
    });
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(CODEX_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(CODEX_CONFIG.configSubDir, CODEX_CONFIG.configFileName);
  }

  private appConfigPath(): Promise<string> {
    return this.configFile.configPath(CODEX_CONFIG.configSubDir, CODEX_CONFIG.appConfigFileName);
  }
}
