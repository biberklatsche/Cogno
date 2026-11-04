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
  hookStateOf,
  isCognoHookCommand,
  isCurrentHookCommand,
} from "../_shared/hook-command";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookMessages$, sessionEvents$, statusTable } from "../_shared/hook-transport";
import { KIMI_CONFIG, KimiConfig } from "./kimi.config";

@Injectable({ providedIn: "root" })
export class KimiProvider implements ICodingAgentProvider {
  readonly id = KIMI_CONFIG.id;
  readonly name = KIMI_CONFIG.name;
  readonly processNames = KIMI_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = sessionEvents$(hookMessages$(ipc, this.id), {
      statusOf: statusTable(KIMI_CONFIG.hookEvents),
      interpret: interpretClaudeStyleHook,
      sessionOf: claudeStyleSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const scripts = await this.scripts.get();
    const config = await this.configFile.readToml<KimiConfig>(await this.configPath(), {});
    const hooks = Array.isArray(config.hooks) ? config.hooks : [];
    const isCurrent = KIMI_CONFIG.hookEvents.every(({ eventName }) =>
      hooks.some(
        (h) =>
          h.event === eventName && isCurrentHookCommand(h.command, scripts, this.id, eventName),
      ),
    );
    return hookStateOf(
      isCurrent,
      hooks.some((h) => isCognoHookCommand(h.command)),
    );
  }

  async installHook(shell: HookShell): Promise<void> {
    const scripts = await this.scripts.get();
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const withoutCogno = (Array.isArray(config.hooks) ? config.hooks : []).filter(
      (h) => !isCognoHookCommand(h.command),
    );
    config.hooks = [
      ...withoutCogno,
      ...KIMI_CONFIG.hookEvents.map((entry) => ({
        event: entry.eventName,
        command: hookCommand(scripts, shell, this.id, entry.eventName),
      })),
    ];
    await this.configFile.writeToml(configPath, config);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    if (Array.isArray(config.hooks)) {
      config.hooks = config.hooks.filter((h) => !isCognoHookCommand(h.command));
      await this.configFile.writeToml(configPath, config);
    }
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(KIMI_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(KIMI_CONFIG.configSubDir, KIMI_CONFIG.configFileName);
  }
}
