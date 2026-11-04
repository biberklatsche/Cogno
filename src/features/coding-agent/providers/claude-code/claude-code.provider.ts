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
import {
  HookShell,
  hookCommand,
  isCognoHookCommand,
  isCurrentHookCommand,
} from "../_shared/hook-command";
import {
  HookMapFormat,
  hookMapState,
  withCurrentCognoHooks,
  withoutCognoHooksOnEveryEvent,
} from "../_shared/hook-groups";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookMessages$, sessionEvents$, statusTable } from "../_shared/hook-transport";
import {
  CLAUDE_CODE_CONFIG,
  ClaudeHookEntry,
  ClaudeHookGroup,
  ClaudeSettings,
} from "./claude-code.config";

@Injectable({ providedIn: "root" })
export class ClaudeCodeProvider implements ICodingAgentProvider {
  readonly id = CLAUDE_CODE_CONFIG.id;
  readonly name = CLAUDE_CODE_CONFIG.name;
  readonly processNames = CLAUDE_CODE_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = sessionEvents$(hookMessages$(ipc, this.id), {
      statusOf: statusTable(CLAUDE_CODE_CONFIG.hookEvents),
      interpret: interpretClaudeStyleHook,
      sessionOf: claudeStyleSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const settings = await this.configFile.readJson<ClaudeSettings>(await this.configPath(), {});
    return hookMapState(settings.hooks, CLAUDE_CODE_CONFIG.hookEvents, await this.hookFormat());
  }

  async installHook(shell: HookShell): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    settings.hooks = withCurrentCognoHooks(
      settings.hooks,
      CLAUDE_CODE_CONFIG.hookEvents,
      await this.hookFormat(shell),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const settings = await this.configFile.readJson<ClaudeSettings>(configPath, {});
    if (!settings.hooks) return;
    settings.hooks = withoutCognoHooksOnEveryEvent(settings.hooks, (hook) =>
      isCognoHookCommand(hook.command),
    );
    await this.configFile.writeJson(configPath, settings);
  }

  private async hookFormat(
    shell: HookShell = "sh",
  ): Promise<HookMapFormat<ClaudeHookEntry, ClaudeHookGroup>> {
    const scripts = await this.scripts.get();
    return {
      groupFor: (entry) => ({
        ...(entry.matcher ? { matcher: entry.matcher } : {}),
        hooks: [
          {
            type: "command",
            command: hookCommand(scripts, shell, this.id, entry.eventName),
            shell: shell === "sh" ? "bash" : "powershell",
          },
        ],
      }),
      isCurrent: (hook, entry) =>
        isCurrentHookCommand(hook.command, scripts, this.id, entry.eventName),
      isCogno: (hook) => isCognoHookCommand(hook.command),
    };
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(CLAUDE_CODE_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(
      CLAUDE_CODE_CONFIG.configSubDir,
      CLAUDE_CODE_CONFIG.configFileName,
    );
  }
}
