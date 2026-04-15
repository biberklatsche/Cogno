import { CommandShellConstraints, CommandSpecSource } from "./command-spec.source";
import { CommandSpec } from "./spec.types";

type ManifestEntry = {
  name: string;
  file: string;
  description?: string;
  shells?: CommandShellConstraints["shells"];
  excludeShells?: CommandShellConstraints["excludeShells"];
};

const MANIFEST_URL = "/feature-data/base/spec-command/manifest.json";
const COMMANDS_BASE_URL = "/feature-data/base/spec-command/commands/";

export class AssetCommandSpecRegistry implements CommandSpecSource {
  private readonly _cache = new Map<string, CommandSpec>();
  private readonly _inFlight = new Map<string, Promise<CommandSpec | undefined>>();
  private _manifestPromise?: Promise<Map<string, ManifestEntry>>;

  async commandNames(): Promise<string[]> {
    const map = await this.loadManifest();
    return [...map.keys()];
  }

  getConstraints(command: string): Promise<CommandShellConstraints | undefined> {
    return this.loadManifest().then((map) => {
      const row = map.get(command);
      if (!row) return undefined;
      return {
        shells: row.shells,
        excludeShells: row.excludeShells,
        description: row.description,
      };
    });
  }

  async get(command: string): Promise<CommandSpec | undefined> {
    const cached = this._cache.get(command);
    if (cached) return cached;

    const inFlight = this._inFlight.get(command);
    if (inFlight) return inFlight;

    const task = this.loadSpec(command)
      .catch(() => undefined)
      .finally(() => this._inFlight.delete(command));
    this._inFlight.set(command, task);
    return task;
  }

  private async loadSpec(command: string): Promise<CommandSpec | undefined> {
    const manifest = await this.loadManifest();
    const row = manifest.get(command);
    if (!row) return undefined;
    const response = await fetch(`${COMMANDS_BASE_URL}${row.file}`);
    if (!response.ok) return undefined;
    const spec = (await response.json()) as CommandSpec;
    if (!spec?.name?.trim()) return undefined;
    this._cache.set(command, spec);
    return spec;
  }

  private loadManifest(): Promise<Map<string, ManifestEntry>> {
    if (this._manifestPromise) return this._manifestPromise;

    this._manifestPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ManifestEntry[]) => {
        const map = new Map<string, ManifestEntry>();
        for (const row of rows ?? []) {
          const name = row?.name?.trim();
          const file = row?.file?.trim();
          if (!name || !file) continue;
          map.set(name, row);
        }
        return map;
      })
      .catch(() => new Map<string, ManifestEntry>());

    return this._manifestPromise;
  }
}
