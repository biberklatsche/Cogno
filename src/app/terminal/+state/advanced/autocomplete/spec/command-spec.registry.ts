import { CommandSpec } from "./spec.types";
import { FIG_SUBSET_IMPORTED_SPECS } from "./imported/fig-subset.specs";
import { importFigSubsetSpecs } from "./importer/fig-lite.importer";
import { FIG_SECONDARY_OPTIONS } from "./imported/fig-secondary-options";

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

export const DEFAULT_COMMAND_SPECS: CommandSpec[] = withSecondaryOptions(
    importFigSubsetSpecs(FIG_SUBSET_IMPORTED_SPECS)
);

function withSecondaryOptions(specs: CommandSpec[]): CommandSpec[] {
    return specs.map(spec => {
        const secondary = FIG_SECONDARY_OPTIONS[spec.name];
        if (!secondary) return spec;
        return {
            ...spec,
            subcommandOptions: {
                ...(spec.subcommandOptions ?? {}),
                ...secondary,
            },
        };
    });
}
