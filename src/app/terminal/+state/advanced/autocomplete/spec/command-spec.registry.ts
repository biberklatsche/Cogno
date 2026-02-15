import { CommandSpec } from "./spec.types";
import { FIG_SUBSET_IMPORTED_SPECS } from "./imported/fig-subset.specs";
import { importFigSubsetSpecs } from "./importer/fig-lite.importer";

export class CommandSpecRegistry {
    private readonly _specs = new Map<string, CommandSpec>();

    constructor(specs: CommandSpec[]) {
        for (const spec of specs) {
            this._specs.set(spec.name, spec);
        }
    }

    commandNames(): string[] {
        return [...this._specs.keys()];
    }

    get(command: string): CommandSpec | undefined {
        return this._specs.get(command);
    }
}

export const DEFAULT_COMMAND_SPECS: CommandSpec[] = importFigSubsetSpecs(FIG_SUBSET_IMPORTED_SPECS);
