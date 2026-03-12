import {
  IPathAdapter,
  ShellContextContract,
  ShellPathAdapterDefinitionContract,
  ShellTypeContract,
} from "@cogno/core-sdk";

export class PathFactory {
  private static definitionsByShellType = new Map<ShellTypeContract, ShellPathAdapterDefinitionContract>();

  static registerDefinitions(definitions: ReadonlyArray<ShellPathAdapterDefinitionContract>): void {
    for (const definition of definitions) {
      this.definitionsByShellType.set(definition.shellType, definition);
    }
  }

  static setDefinitions(definitions: ReadonlyArray<ShellPathAdapterDefinitionContract>): void {
    this.definitionsByShellType.clear();
    this.registerDefinitions(definitions);
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
