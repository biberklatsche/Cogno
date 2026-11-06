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
  cognoHookState,
  hasCognoCommand,
  hookCommand,
  isCurrentHookCommand,
} from "../_shared/hook-command";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookSessionEvents$ } from "../_shared/hook-transport";
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
    this.events$ = hookSessionEvents$(ipc, this.id, {
      hookEvents: KIMI_CONFIG.hookEvents,
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
    const cognoHooks = hooks
      .filter(hasCognoCommand)
      .map((hook) => ({ eventName: hook.event, hook }));
    return cognoHookState(cognoHooks, KIMI_CONFIG.hookEvents, (hook, { eventName }) =>
      isCurrentHookCommand(hook.command, scripts, this.id, eventName),
    );
  }

  async installHook(): Promise<void> {
    const shell = this.scripts.shell();
    const scripts = await this.scripts.get();
    await this.configFile.ensureDir(await this.configDir());
    const configPath = await this.configPath();
    const config = await this.configFile.readToml<KimiConfig>(configPath, {});
    const withoutCogno = (Array.isArray(config.hooks) ? config.hooks : []).filter(
      (h) => !hasCognoCommand(h),
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
      config.hooks = config.hooks.filter((h) => !hasCognoCommand(h));
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
