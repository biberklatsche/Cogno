import { CommandShellConstraints, CommandSpecSource } from "../command-spec.source";
import { CommandSpec } from "../spec.types";

/** An in-memory spec source for tests. */
export class CommandSpecRegistry implements CommandSpecSource {
  private readonly _specs = new Map<string, CommandSpec>();

  constructor(specs: CommandSpec[]) {
    for (const spec of specs) {
      this._specs.set(spec.name, spec);
    }
  }

  async commandNames(): Promise<string[]> {
    return [...this._specs.keys()];
  }

  async get(command: string): Promise<CommandSpec | undefined> {
    return this._specs.get(command);
  }

  async getConstraints(command: string): Promise<CommandShellConstraints | undefined> {
    const spec = this._specs.get(command);
    if (!spec) return undefined;
    return {
      shells: spec.shells,
      excludeShells: spec.excludeShells,
      description: spec.description,
    };
  }
}
