import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import {
  AgentSessionEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { Observable } from "rxjs";
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
import { CURSOR_CONFIG, CursorHooksFile } from "./cursor.config";
import { cursorSession, interpretCursorHook } from "./cursor-hook.interpreter";

type CursorHookMap = NonNullable<CursorHooksFile["hooks"]>;

/**
 * Cursor's own hooks in `~/.cursor/hooks.json`. Cursor also runs Claude Code's
 * hooks when its third-party imports are on; those report as Claude Code, so a
 * Cursor session gets its own hook and its own name here.
 */
@Injectable({ providedIn: "root" })
export class CursorProvider implements ICodingAgentProvider {
  readonly id = CURSOR_CONFIG.id;
  readonly name = CURSOR_CONFIG.name;
  readonly processNames = CURSOR_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = sessionEvents$(hookMessages$(ipc, this.id), {
      statusOf: statusTable(CURSOR_CONFIG.hookEvents),
      interpret: interpretCursorHook,
      sessionOf: cursorSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const scripts = await this.scripts.get();
    const hooks = (await this.readHooksFile()).hooks ?? {};
    const isCurrent = CURSOR_CONFIG.hookEvents.every(({ eventName }) =>
      (hooks[eventName] ?? []).some((h) =>
        isCurrentHookCommand(h.command, scripts, this.id, eventName),
      ),
    );
    const hasCognoHook = Object.values(hooks).some((list) =>
      list.some((h) => isCognoHookCommand(h.command)),
    );
    return hookStateOf(isCurrent, hasCognoHook);
  }

  async installHook(shell: HookShell): Promise<void> {
    const scripts = await this.scripts.get();
    await this.configFile.ensureDir(await this.configDir());
    const file = await this.readHooksFile();
    file.version = file.version ?? CURSOR_CONFIG.fileVersion;
    const hooks = withoutCognoHooks(file.hooks ?? {});
    for (const entry of CURSOR_CONFIG.hookEvents) {
      const command = hookCommand(scripts, shell, this.id, entry.eventName);
      hooks[entry.eventName] = [...(hooks[entry.eventName] ?? []), { command }];
    }
    file.hooks = hooks;
    await this.configFile.writeJson(await this.configPath(), file);
  }

  async removeHook(): Promise<void> {
    const file = await this.readHooksFile();
    if (!file.hooks) return;
    file.hooks = withoutCognoHooks(file.hooks);
    await this.configFile.writeJson(await this.configPath(), file);
  }

  private async readHooksFile(): Promise<CursorHooksFile> {
    return this.configFile.readJson<CursorHooksFile>(await this.configPath(), {});
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(CURSOR_CONFIG.configSubDir);
  }

  private configPath(): Promise<string> {
    return this.configFile.configPath(CURSOR_CONFIG.configSubDir, CURSOR_CONFIG.configFileName);
  }
}

/**
 * The hook map without Cogno's hooks on every event - including events an older
 * Cogno version hooked and this one no longer does. Events left empty are dropped.
 */
function withoutCognoHooks(hooks: Readonly<CursorHookMap>): CursorHookMap {
  const cleaned: CursorHookMap = {};
  for (const [eventName, list] of Object.entries(hooks)) {
    const remaining = list.filter((h) => !isCognoHookCommand(h.command));
    if (remaining.length > 0) cleaned[eventName] = remaining;
  }
  return cleaned;
}
