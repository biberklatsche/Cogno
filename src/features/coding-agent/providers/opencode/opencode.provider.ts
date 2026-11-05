import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import {
  AgentSessionEvent,
  HookState,
  ICodingAgentProvider,
} from "@cogno/features/coding-agent/ports";
import { Observable } from "rxjs";
import { ConfigFileService } from "../_shared/config-file.service";
import { HookScriptPathsService } from "../_shared/hook-script-paths.service";
import { hookMessages$, sessionEvents$, statusTable } from "../_shared/hook-transport";
import { OPENCODE_CONFIG, openCodePlugin } from "./opencode.config";
import { interpretOpenCodeEvent, openCodeSession } from "./opencode-event.interpreter";

/**
 * Cogno's OpenCode plugin: a folder of Cogno's own under OpenCode's plugins,
 * so installing writes it, removing deletes it, and nothing of the user's is
 * touched. The plugin runs in OpenCode's background service, which has no
 * terminal: a session is placed by its folder (ARCHITECTURE.md 3.2). The
 * shell plays no part; the plugin runs inside OpenCode on every platform.
 */
@Injectable({ providedIn: "root" })
export class OpenCodeProvider implements ICodingAgentProvider {
  readonly id = OPENCODE_CONFIG.id;
  readonly name = OPENCODE_CONFIG.name;
  readonly processNames = OPENCODE_CONFIG.processNames;
  readonly events$: Observable<AgentSessionEvent>;

  constructor(
    private readonly configFile: ConfigFileService,
    private readonly scripts: HookScriptPathsService,
    ipc: TerminalIpcPort,
  ) {
    this.events$ = sessionEvents$(hookMessages$(ipc, this.id), {
      statusOf: statusTable(OPENCODE_CONFIG.hookEvents),
      interpret: interpretOpenCodeEvent,
      sessionOf: openCodeSession,
    });
  }

  async isAgentInstalled(): Promise<boolean> {
    return this.configFile.exists(await this.configDir());
  }

  /** Current when the plugin file is this version's and no older plugin of Cogno's is left. */
  async hookState(): Promise<HookState> {
    const current = await this.configFile.readText(await this.pluginPath());
    const legacy = await this.configFile.exists(await this.legacyPluginPath());
    if (current === (await this.pluginSource())) return legacy ? "outdated" : "current";
    return current !== undefined || legacy ? "outdated" : "missing";
  }

  /** Writes only what changed: OpenCode reloads its plugins on every write to the folder. */
  async installHook(): Promise<void> {
    await this.configFile.ensureDir(await this.pluginDir());
    const path = await this.pluginPath();
    const source = await this.pluginSource();
    if ((await this.configFile.readText(path)) !== source) {
      await this.configFile.writeText(path, source);
    }
    await this.configFile.remove(await this.legacyPluginPath());
  }

  async removeHook(): Promise<void> {
    await this.configFile.remove(await this.pluginDir(), { recursive: true });
    await this.configFile.remove(await this.legacyPluginPath());
  }

  private async pluginSource(): Promise<string> {
    return openCodePlugin(await this.scripts.endpointPath());
  }

  private configDir(): Promise<string> {
    return this.configFile.configDir(OPENCODE_CONFIG.configSubDir);
  }

  private async pluginsDir(): Promise<string> {
    return this.configFile.configPath(OPENCODE_CONFIG.configSubDir, OPENCODE_CONFIG.pluginsSubDir);
  }

  private async pluginDir(): Promise<string> {
    return this.configFile.join(await this.pluginsDir(), OPENCODE_CONFIG.pluginDirName);
  }

  private async pluginPath(): Promise<string> {
    return this.configFile.join(await this.pluginDir(), OPENCODE_CONFIG.pluginFileName);
  }

  private async legacyPluginPath(): Promise<string> {
    return this.configFile.join(await this.pluginsDir(), OPENCODE_CONFIG.legacyPluginFileName);
  }
}
