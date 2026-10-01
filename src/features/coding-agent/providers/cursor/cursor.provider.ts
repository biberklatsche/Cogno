import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { ConfigFileService } from "../_shared/config-file.service";
import {
  buildHookCommand,
  hookStateOf,
  isCurrentHookCommand,
} from "../_shared/hook-command.builder";
import { CURSOR_CONFIG, CursorHooksFile } from "./cursor.config";
import { interpretCursorHook } from "./cursor-hook.interpreter";

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

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretCursorHook(hookEvent, status, payload);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const hooks = (await this.readHooksFile()).hooks ?? {};
    const isCurrent = CURSOR_CONFIG.hookEvents.every(({ eventName, status }) =>
      (hooks[eventName] ?? []).some((h) =>
        isCurrentHookCommand(h.command, status, this.id, eventName),
      ),
    );
    const hasCognoHook = Object.values(hooks).some((list) =>
      list.some((h) => CURSOR_CONFIG.isCognoCommand(h.command)),
    );
    return hookStateOf(isCurrent, hasCognoHook);
  }

  async installHook(shellType?: string): Promise<void> {
    await this.configFile.ensureDir(await this.configDir());
    const file = await this.readHooksFile();
    file.version = file.version ?? CURSOR_CONFIG.fileVersion;
    const hooks = withoutCognoHooks(file.hooks ?? {});
    for (const entry of CURSOR_CONFIG.hookEvents) {
      const command = buildHookCommand(entry.status, shellType, this.id, entry.eventName);
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

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), CURSOR_CONFIG.configSubDir);
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CURSOR_CONFIG.configFileName);
  }
}

/**
 * The hook map without Cogno's hooks on every event - including events an older
 * Cogno version hooked and this one no longer does. Events left empty are dropped.
 */
function withoutCognoHooks(hooks: Readonly<CursorHookMap>): CursorHookMap {
  const cleaned: CursorHookMap = {};
  for (const [eventName, list] of Object.entries(hooks)) {
    const remaining = list.filter((h) => !CURSOR_CONFIG.isCognoCommand(h.command));
    if (remaining.length > 0) cleaned[eventName] = remaining;
  }
  return cleaned;
}
