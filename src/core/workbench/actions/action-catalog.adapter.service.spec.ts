import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import type { ActionEntryContract } from "@cogno/shared/domain";
import { of } from "rxjs";
import { describe, expect, it } from "vitest";
import { ActionCatalogAdapterService } from "./action-catalog.adapter.service";
import { ActionNameRegistry } from "./action-name-registry";

function entries(): ReadonlyArray<ActionEntryContract> {
  const featureActionNames = new ActionNameRegistry();
  featureActionNames.register(["open_git"]);
  const adapter = new ActionCatalogAdapterService(
    new AppBus(),
    { config$: of({}) } as unknown as ConfigService,
    {
      getActionNames: () => [],
      getActionDefinition: () => undefined,
      getKeybinding: () => "",
    } as unknown as KeybindService,
    featureActionNames,
  );
  let latest: ReadonlyArray<ActionEntryContract> = [];
  adapter.actionEntries$.subscribe((value) => (latest = value));
  return latest;
}

describe("ActionCatalogAdapterService", () => {
  it("gives a core action its catalog label", () => {
    const settings = entries().find((entry) => entry.actionDefinition.actionName === "open_config");

    expect(settings?.label).toBe("Settings");
  });

  it("leaves a feature action without a label", () => {
    const git = entries().find((entry) => entry.actionDefinition.actionName === "open_git");

    expect(git).toBeDefined();
    expect(git?.label).toBeUndefined();
  });
});
