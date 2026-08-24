import { ActionName } from "@cogno/app/action/action.models";
import { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { Icon } from "@cogno/shared/ui";
import { SideMenuFeatureRegistryContract } from "./side-menu-feature-registry.contract";

type Definition = SideMenuFeatureDefinitionContract<Icon, ActionName>;

/**
 * Joins the neutral side-menu definitions contributed by features with the
 * UI half (panel component, lifecycle) provided by the bootstrap, by id.
 */
export class SideMenuDefinitionRegistry
  implements SideMenuFeatureRegistryContract<Icon, ActionName>
{
  private readonly definitionsById = new Map<string, Definition>();
  private readonly uiById = new Map<string, SideMenuFeatureDefinition>();

  registerSideMenuFeature(definition: Definition): void {
    if (this.definitionsById.has(definition.id)) {
      throw new Error(`Side menu feature registered twice: ${definition.id}`);
    }
    this.definitionsById.set(definition.id, definition);
  }

  registerSideMenuFeatureExtension(ui: SideMenuFeatureDefinition): void {
    if (this.uiById.has(ui.id)) {
      throw new Error(`Side menu feature UI registered twice: ${ui.id}`);
    }
    this.uiById.set(ui.id, ui);
  }

  getSideMenuFeatureDefinitionById(id: string): Definition | undefined {
    return this.definitionsById.get(id);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<Definition> {
    return [...this.definitionsById.values()].sort((left, right) => left.order - right.order);
  }

  resolveSideMenuFeatureDefinitionById<TResolved>(
    id: string,
    resolve: (definition: Definition, ui: SideMenuFeatureDefinition | undefined) => TResolved,
  ): TResolved | undefined {
    const definition = this.definitionsById.get(id);
    if (definition === undefined) {
      return undefined;
    }
    return resolve(definition, this.uiById.get(id));
  }

  resolveSideMenuFeatureDefinitions<TResolved>(
    resolve: (definition: Definition, ui: SideMenuFeatureDefinition | undefined) => TResolved,
  ): ReadonlyArray<TResolved> {
    return this.getSideMenuFeatureDefinitions().map((definition) =>
      resolve(definition, this.uiById.get(definition.id)),
    );
  }
}
