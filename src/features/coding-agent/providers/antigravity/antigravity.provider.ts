import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import {
  AgentHookEvent,
  AgentSessionEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { Observable } from "rxjs";
import { AgentStatus } from "../../agent-status";
import { ConfigFileService } from "../_shared/config-file.service";
import { hookCommand, isCurrentHookCommand } from "../_shared/hook-command";
import { payloadFields, stringField } from "../_shared/hook-payload";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookSessionEvents$ } from "../_shared/hook-transport";
import {
  ANTIGRAVITY_CONFIG,
  AntigravityHookDefinition,
  AntigravityHooksFile,
} from "./antigravity.config";

/** Of Antigravity's hook payloads only `modelName`, sent on every hook, is read. */
export function interpretAntigravityHook(
  _hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent {
  const model = stringField(payloadFields(payload), "modelName");
  return { kind: "status", status, sessionBoundary: false, details: model ? { model } : {} };
}

@Injectable({ providedIn: "root" })
export class AntigravityProvider implements ICodingAgentProvider {
  readonly id = ANTIGRAVITY_CONFIG.id;
  readonly name = ANTIGRAVITY_CONFIG.name;
  readonly processNames = ANTIGRAVITY_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = hookSessionEvents$(ipc, this.id, {
      hookEvents: ANTIGRAVITY_CONFIG.hookEvents,
      interpret: interpretAntigravityHook,
      // Antigravity's payload names no session: its hooks run in the terminal, which stands in.
      sessionOf: () => ({}),
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  /** Cogno's hook is its own named entry: when it is there but not current, it is outdated. */
  async hookState(): Promise<HookState> {
    const hook = (await this.readHooksFile())[ANTIGRAVITY_CONFIG.hookName];
    if (!hook) return "missing";
    const scripts = await this.scripts.get();
    const isCurrent = ANTIGRAVITY_CONFIG.hookEvents.every((entry) => {
      const handlers =
        entry.kind === "tool"
          ? (hook[entry.eventName] ?? []).flatMap((group) => group.hooks)
          : (hook[entry.eventName] ?? []);
      return handlers.some((h) =>
        isCurrentHookCommand(h.command, scripts, this.id, entry.eventName, entry.stdout),
      );
    });
    return isCurrent ? "current" : "outdated";
  }

  async installHook(): Promise<void> {
    const shell = this.scripts.shell();
    const scripts = await this.scripts.get();
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configPath();
    const file = await this.readHooksFile();
    const hook: AntigravityHookDefinition = {};
    for (const entry of ANTIGRAVITY_CONFIG.hookEvents) {
      const command = hookCommand(scripts, shell, this.id, entry.eventName, entry.stdout);
      if (entry.kind === "tool") {
        hook[entry.eventName] = [{ matcher: entry.matcher, hooks: [{ type: "command", command }] }];
      } else {
        hook[entry.eventName] = [{ type: "command", command }];
      }
    }
    file[ANTIGRAVITY_CONFIG.hookName] = hook;
    await this.configFile.writeJson(configPath, file);
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.readHooksFile();
    if (!(ANTIGRAVITY_CONFIG.hookName in file)) return;
    delete file[ANTIGRAVITY_CONFIG.hookName];
    await this.configFile.writeJson(configPath, file);
  }

  private async readHooksFile(): Promise<AntigravityHooksFile> {
    return this.configFile.readJson<AntigravityHooksFile>(await this.configPath(), {});
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(ANTIGRAVITY_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(
      ANTIGRAVITY_CONFIG.configSubDir,
      ANTIGRAVITY_CONFIG.configFileName,
    );
  }
}
