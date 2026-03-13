import { CommandSpec } from "./spec.types";
import { CommandShellConstraints, CommandSpecSource } from "./command-spec.source";

export class CommandSpecRegistry implements CommandSpecSource {
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

    getConstraints(command: string): CommandShellConstraints | undefined {
        const spec = this._specs.get(command);
        if (!spec) return undefined;
        return {
            shells: spec.shells,
            excludeShells: spec.excludeShells,
            description: spec.description,
        };
    }
}
