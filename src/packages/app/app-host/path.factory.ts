import {
  IPathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
  ShellTypeContract,
} from "@cogno/core-api";

export class PathFactory {
  private static definitionsByShellType = new Map<
    ShellTypeContract,
    ShellPathAdapterDefinitionContract
  >();

  static registerDefinitions(definitions: ReadonlyArray<ShellPathAdapterDefinitionContract>): void {
    for (const definition of definitions) {
      PathFactory.definitionsByShellType.set(definition.shellType, definition);
    }
  }

  static setDefinitions(definitions: ReadonlyArray<ShellPathAdapterDefinitionContract>): void {
    PathFactory.definitionsByShellType.clear();
    PathFactory.registerDefinitions(definitions);
  }

  static resetDefinitions(): void {
    PathFactory.definitionsByShellType.clear();
  }

  static createAdapter(context: ShellContextContract): IPathAdapter {
    const shellType =
      typeof context === "object" && context !== null && "shellType" in context
        ? String(context.shellType)
        : String(context);
    const definition = PathFactory.definitionsByShellType.get(context.shellType);
    if (!definition) {
      throw new Error(`Unsupported shell type: ${shellType}`);
    }
    return definition.createPathAdapter(context);
  }
}
