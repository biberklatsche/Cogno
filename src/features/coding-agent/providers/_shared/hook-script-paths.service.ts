import { Injectable, isDevMode } from "@angular/core";
import { Fs, Paths } from "@cogno/platform";
import { HookScriptPaths } from "./hook-command";
import { bashHookScript, powershellHookScript } from "./hook-scripts";

/** The feature's folder in the Cogno home, and the endpoint file Cogno's HTTP server writes there. */
const SCRIPTS_DIR = "coding-agents";
const ENDPOINT_FILE = "endpoint.json";
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
    private readonly fs: Fs,
    private readonly paths: Paths,
  ) {}

  /** The scripts' paths, once they are written. A failed write is tried again on the next call. */
  get(): Promise<HookScriptPaths> {
    this.scripts ??= this.write().catch((error: unknown) => {
      this.scripts = undefined;
      throw error;
    });
    return this.scripts;
  }

  /** The endpoint file the scripts fall back to; an adapter with its own transport (a plugin) reads it the same way. */
  async endpointPath(): Promise<string> {
    return this.paths.join(await this.paths.cognoHomeDir(isDevMode()), ENDPOINT_FILE);
  }

  private async write(): Promise<HookScriptPaths> {
    const home = await this.paths.cognoHomeDir(isDevMode());
    const dir = await this.paths.join(home, SCRIPTS_DIR);
    const endpoint = await this.endpointPath();
    const scripts = {
      bash: await this.paths.join(dir, BASH_SCRIPT),
      powershell: await this.paths.join(dir, POWERSHELL_SCRIPT),
    };
    if (!(await this.fs.exists(dir))) await this.fs.mkdir(dir, { recursive: true });
    await this.writeIfChanged(scripts.bash, bashHookScript(endpoint));
    await this.writeIfChanged(scripts.powershell, powershellHookScript(endpoint));
    return scripts;
  }

  private async writeIfChanged(path: string, content: string): Promise<void> {
    if ((await this.fs.exists(path)) && (await this.fs.readTextFile(path)) === content) return;
    await this.fs.writeTextFile(path, content);
  }
}
