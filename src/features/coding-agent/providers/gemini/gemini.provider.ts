import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import {
  AgentSessionEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { Observable } from "rxjs";
import { claudeStyleSession } from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import {
  HookShell,
  hasCognoCommand,
  hookCommand,
  isCurrentHookCommand,
} from "../_shared/hook-command";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookSessionEvents$ } from "../_shared/hook-transport";
import { GEMINI_CONFIG, GeminiHookEntry, GeminiHookGroup, GeminiSettings } from "./gemini.config";
import { interpretGeminiHook } from "./gemini-hook.interpreter";

@Injectable({ providedIn: "root" })
export class GeminiProvider implements ICodingAgentProvider {
  readonly id = GEMINI_CONFIG.id;
  readonly name = GEMINI_CONFIG.name;
  readonly processNames = GEMINI_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = hookSessionEvents$(ipc, this.id, {
      hookEvents: GEMINI_CONFIG.hookEvents,
      interpret: interpretGeminiHook,
      // Gemini CLI names `session_id` and `cwd` like the Claude protocol.
      sessionOf: claudeStyleSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const settings = await this.configFile.readJson<GeminiSettings>(await this.configPath(), {});
    return hookMapState(settings.hooks, GEMINI_CONFIG.hookEvents, await this.hookFormat());
  }

  async installHook(): Promise<void> {
    const shell = this.scripts.shell();
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    settings.hooks = withCurrentCognoHooks(
      settings.hooks,
      GEMINI_CONFIG.hookEvents,
      await this.hookFormat(shell),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<GeminiSettings>(configPath, {});
    if (!settings.hooks) return;
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, hasCognoCommand);
    await this.configFile.writeJson(configPath, settings);
  }

  private async hookFormat(
    shell: HookShell = "sh",
  ): Promise<HookMapFormat<GeminiHookEntry, GeminiHookGroup>> {
    const scripts = await this.scripts.get();
    return {
      groupFor: (entry) => ({
        hooks: [
          { type: "command", command: hookCommand(scripts, shell, this.id, entry.eventName) },
        ],
      }),
      isCurrent: (hook, entry) =>
        isCurrentHookCommand(hook.command, scripts, this.id, entry.eventName),
      isCogno: hasCognoCommand,
    };
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(GEMINI_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(GEMINI_CONFIG.configSubDir, GEMINI_CONFIG.configFileName);
  }
}
