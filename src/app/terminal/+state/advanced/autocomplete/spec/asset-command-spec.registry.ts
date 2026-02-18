import { CommandSpec } from "./spec.types";
import { CommandShellConstraints, CommandSpecSource } from "./command-spec.source";
import { importFigSubsetSpecs } from "./importer/fig-lite.importer";

type JsonModule = { default: CommandSpec } | CommandSpec;
type Loader = () => Promise<JsonModule>;

type ManifestEntry = {
    name: string;
    file: string;
    shells?: CommandShellConstraints["shells"];
    excludeShells?: CommandShellConstraints["excludeShells"];
};

const MANIFEST_URL = "/assets/autocomplete/fig/manifest.json";
const GLOB_BASE = "../../../../../../assets/autocomplete/fig/commands/";

export class AssetCommandSpecRegistry implements CommandSpecSource {
    private readonly _cache = new Map<string, CommandSpec>();
    private readonly _inFlight = new Map<string, Promise<CommandSpec | undefined>>();
    private readonly _loaders = import.meta.glob("../../../../../../assets/autocomplete/fig/commands/*.json") as Record<string, Loader>;
    private readonly _loaderByFile = new Map<string, Loader>();
    private _manifestPromise?: Promise<Map<string, ManifestEntry>>;

    constructor() {
        for (const [key, loader] of Object.entries(this._loaders)) {
            const file = key.startsWith(GLOB_BASE) ? key.slice(GLOB_BASE.length) : key.split("/").at(-1) ?? key;
            this._loaderByFile.set(file, loader);
        }
    }

    async commandNames(): Promise<string[]> {
        const map = await this.loadManifest();
        return [...map.keys()];
    }

    getConstraints(command: string): Promise<CommandShellConstraints | undefined> {
        return this.loadManifest().then(map => {
            const row = map.get(command);
            if (!row) return undefined;
            return {
                shells: row.shells,
                excludeShells: row.excludeShells,
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
        const loader = this._loaderByFile.get(row.file);
        if (!loader) return undefined;
        const mod = await loader();
        const raw = (mod as { default?: CommandSpec }).default ?? (mod as CommandSpec);
        const imported = importFigSubsetSpecs([raw])[0];
        if (imported) this._cache.set(command, imported);
        return imported;
    }

    private loadManifest(): Promise<Map<string, ManifestEntry>> {
        if (this._manifestPromise) return this._manifestPromise;

        this._manifestPromise = fetch(MANIFEST_URL)
            .then(res => (res.ok ? res.json() : []))
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

