import { Injectable, isDevMode } from "@angular/core";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { OsPlatform, Paths } from "@cogno/platform";
import { ConfigFileService } from "./config-file.service";
import { HookScriptPaths, HookShell } from "./hook-command";
import { bashHookScript, powershellHookScript } from "./hook-scripts";

/** The feature's folder in the Cogno home. */
const SCRIPTS_DIR = "coding-agents";
const BASH_SCRIPT = "cogno-agent-hook.sh";
const POWERSHELL_SCRIPT = "cogno-agent-hook.ps1";

/**
 * The hook scripts every hook-based adapter's command runs (ARCHITECTURE.md
 * 3.2). Written once per run, and only where the content changed: the
 * command in an agent's config names the script and never changes, so a new
 * protocol reaches the agents without touching their configs.
 */
@Injectable({ providedIn: "root" })
export class HookScriptPathsService {
  private scripts?: Promise<HookScriptPaths>;

  constructor(
    private readonly files: ConfigFileService,
    private readonly paths: Paths,
    private readonly config: ApplicationConfigurationPort,
    private readonly os: OsPlatform,
  ) {}

  /** The scripts' paths, once they are written. A failed write is tried again on the next call. */
  get(): Promise<HookScriptPaths> {
    this.scripts ??= this.write().catch((error: unknown) => {
      this.scripts = undefined;
      throw error;
    });
    return this.scripts;
  }

  /**
   * The shell the hooks run with: PowerShell where the default profile is one
   * (Windows PowerShell on Windows, pwsh elsewhere), else sh.
   */
  shell(): HookShell {
    const shell = this.config.getConfiguration()?.["shell"] as
      | { default?: string; profiles?: Record<string, { shell_type?: string }> }
      | undefined;
    const defaultName = shell?.default;
    const configured = defaultName ? shell?.profiles?.[defaultName]?.shell_type : undefined;
    const windows = this.os.platform() === "windows";
    const powershell = configured ? configured === "PowerShell" : windows;
    if (!powershell) return "sh";
    return windows ? "powershell" : "pwsh";
  }

  /** The endpoint file the scripts fall back to; an adapter with its own transport (a plugin) reads it the same way. */
  async endpointPath(): Promise<string> {
    return this.paths.cognoEndpointFilePath(isDevMode());
  }

  private async write(): Promise<HookScriptPaths> {
    const home = await this.paths.cognoHomeDir(isDevMode());
    const dir = await this.paths.join(home, SCRIPTS_DIR);
    const endpoint = await this.endpointPath();
    const scripts = {
      bash: await this.paths.join(dir, BASH_SCRIPT),
      powershell: await this.paths.join(dir, POWERSHELL_SCRIPT),
    };
    await this.files.ensureDir(dir);
    await this.files.writeText(scripts.bash, bashHookScript(endpoint));
    await this.files.writeText(scripts.powershell, powershellHookScript(endpoint));
    return scripts;
  }
}
