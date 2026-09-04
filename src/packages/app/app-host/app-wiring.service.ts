import { Inject, Injectable } from "@angular/core";
import { shellDefinitions } from "@cogno/core/session/shells/shell-definitions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
import {
  ApplicationSettingsExtensionContract,
  FeatureDefinition,
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
} from "@cogno/shared/contributions";
import { featuresToken } from "./app-host.tokens";

/**
 * Collects what the features contribute and hands each extension point to
 * its consumer. What is left is the native menu's side-menu list, the settings
 * extensions and the shell definitions; the rest moved to the feature-host.
 * The whole service dissolves with config-bootstrap in step 22d.
 */
@Injectable({ providedIn: "root" })
export class AppWiringService {
  private readonly sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition>;
  private readonly settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>;

  constructor(@Inject(featuresToken) features: ReadonlyArray<FeatureDefinition<ActionName>>) {
    this.sideMenuFeatureDefinitions = [
      ...rejectDuplicateIds(
        features.flatMap((feature) => feature.sideMenu ?? []),
        (definition) => definition.id,
        "Side menu feature",
      ),
    ].sort((left, right) => left.order - right.order);
    this.settingsExtensions = features.flatMap((feature) =>
      feature.settings ? [feature.settings] : [],
    );
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<SideMenuFeatureDefinition> {
    return this.sideMenuFeatureDefinitions;
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.settingsExtensions;
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return shellDefinitions.map((shell) => shell.support);
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return shellDefinitions;
  }
}

function rejectDuplicateIds<T>(
  items: ReadonlyArray<T>,
  idOf: (item: T) => string,
  label: string,
): ReadonlyArray<T> {
  const seen = new Set<string>();
  for (const item of items) {
    const id = idOf(item);
    if (seen.has(id)) {
      throw new Error(`${label} registered twice: ${id}`);
    }
    seen.add(id);
  }
  return items;
}
