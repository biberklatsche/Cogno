import { Injectable } from "@angular/core";
import {
  AgentHookEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import { interpretClaudeStyleHook } from "../_shared/claude-style-hook.interpreter";
import { ConfigFileService } from "../_shared/config-file.service";
import { buildHookCommands, hookStateOf } from "../_shared/hook-command.builder";
import { withoutCognoHooks } from "../_shared/hook-groups";
import { PayloadFields, stringField } from "../_shared/hook-payload";
import { CODEX_CONFIG, CodexHookGroup, CodexHooksFile } from "./codex.config";

/** Lines of an apply_patch patch that name a file it adds, updates, deletes or moves to. */
const PATCH_FILE_LINE = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

/** Codex edits files only through apply_patch, whose `command` is the patch itself. */
export function patchedFiles(fields: PayloadFields | undefined): ReadonlyArray<string> {
  if (stringField(fields, "tool_name") !== "apply_patch") return [];
  const input = fields?.["tool_input"];
  const patch =
    input && typeof input === "object" ? (input as PayloadFields)["command"] : undefined;
  if (typeof patch !== "string") return [];
  return [...patch.matchAll(PATCH_FILE_LINE)].flatMap((match) =>
    match[1] ? [match[1].trim()] : [],
  );
}

@Injectable({ providedIn: "root" })
export class CodexProvider implements ICodingAgentProvider {
  readonly id = CODEX_CONFIG.id;
  readonly name = CODEX_CONFIG.name;

  constructor(private readonly configFile: ConfigFileService) {}

  interpretHook(hookEvent: string, status: AgentStatus, payload: unknown): AgentHookEvent {
    return interpretClaudeStyleHook(hookEvent, status, payload, patchedFiles);
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  async hookState(): Promise<HookState> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    const isCurrent = CODEX_CONFIG.hookEvents.every(({ eventName, status }) => {
      const expected = buildHookCommands(status, this.id, eventName);
      return (file.hooks?.[eventName] ?? []).some((group) =>
        group.hooks.some(
          (h) => h.command === expected.command && h.commandWindows === expected.commandWindows,
        ),
      );
    });
    const hasCognoHook = Object.values(file.hooks ?? {}).some((groups) =>
      groups.some((group) =>
        group.hooks.some((h) => CODEX_CONFIG.isCognoCommand(h.command, h.commandWindows)),
      ),
    );
    return hookStateOf(isCurrent, hasCognoHook);
  }

  async installHook(_shellType?: string): Promise<void> {
    const configDir = await this.configDir();
    await this.configFile.ensureDir(configDir);
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});

    file.hooks = file.hooks ?? {};

    for (const entry of CODEX_CONFIG.hookEvents) {
      const { command, commandWindows } = buildHookCommands(entry.status, this.id, entry.eventName);
      const existing: CodexHookGroup[] = file.hooks[entry.eventName] ?? [];
      file.hooks[entry.eventName] = [
        ...withoutCognoHooks(existing, (h) =>
          CODEX_CONFIG.isCognoCommand(h.command, h.commandWindows),
        ),
        { hooks: [{ type: "command", command, commandWindows }] },
      ];
    }

    await this.configFile.writeJson(configPath, file);
    await this.enableHooksInAppConfig();
  }

  async removeHook(): Promise<void> {
    const configPath = await this.configPath();
    const file = await this.configFile.readJson<CodexHooksFile>(configPath, {});
    if (!file.hooks) return;

    for (const { eventName } of CODEX_CONFIG.hookEvents) {
      const existing = file.hooks[eventName];
      if (!existing) continue;
      const cleaned = withoutCognoHooks(existing, (h) =>
        CODEX_CONFIG.isCognoCommand(h.command, h.commandWindows),
      );

      if (cleaned.length === 0) {
        delete file.hooks[eventName];
      } else {
        file.hooks[eventName] = cleaned;
      }
    }

    await this.configFile.writeJson(configPath, file);
  }

  private async enableHooksInAppConfig(): Promise<void> {
    const appConfigPath = await this.configFile.joinPath(
      await this.configDir(),
      CODEX_CONFIG.appConfigFileName,
    );
    const cfg = await this.configFile.readToml<Record<string, unknown>>(appConfigPath, {});
    const features = (cfg["features"] ?? {}) as Record<string, unknown>;
    if (features["hooks"] === true) return;
    features["hooks"] = true;
    cfg["features"] = features;
    await this.configFile.writeToml(appConfigPath, cfg);
  }

  private async configDir(): Promise<string> {
    return this.configFile.joinPath(await this.configFile.homeDir(), CODEX_CONFIG.configSubDir);
  }

  private async configPath(): Promise<string> {
    return this.configFile.joinPath(await this.configDir(), CODEX_CONFIG.configFileName);
  }
}
