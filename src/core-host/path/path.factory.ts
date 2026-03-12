import {
  IPathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
  ShellTypeContract,
} from "@cogno/core-sdk";

export class PathFactory {
  private static definitionsByShellType = new Map<ShellTypeContract, ShellPathAdapterDefinitionContract>();

  static setDefinitions(definitions: ReadonlyArray<ShellPathAdapterDefinitionContract>): void {
    this.definitionsByShellType = new Map(
      definitions.map(definition => [definition.shellType, definition] satisfies [
        ShellTypeContract,
        ShellPathAdapterDefinitionContract,
      ]),
    );
  }

  static resetDefinitions(): void {
    this.definitionsByShellType.clear();
  }

  static createAdapter(context: ShellContextContract): IPathAdapter {
    const shellType =
      typeof context === "object" && context !== null && "shellType" in context
        ? String(context.shellType)
        : String(context);
    const definition = this.definitionsByShellType.get(context.shellType);
    if (!definition) {
      throw new Error(`Unsupported shell type: ${shellType}`);
    }
    return definition.createPathAdapter(context);
  }
}
