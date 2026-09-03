import type { DestroyRef } from "@angular/core";
import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { Opener } from "@cogno/platform/opener";
import { describe, expect, it, vi } from "vitest";
import { ConfigActionsHandler } from "./config-actions.handler";

function setup() {
  const bus = new AppBus();
  const config = { reload: vi.fn(async () => {}) } as unknown as ConfigService;
  const opener = { openPath: vi.fn(), openUrl: vi.fn() } as unknown as Opener;
  const environment = {
    configFilePath: () => "/home/test/.cogno/cogno.config",
  } as unknown as Environment;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;

  new ConfigActionsHandler(bus, config, opener, environment, destroyRef);
  return { bus, config, opener };
}

describe("ConfigActionsHandler", () => {
  it("reloads on load_config and opens the file / docs on the others", async () => {
    const { bus, config, opener } = setup();

    bus.publish(ActionFired.create("load_config"));
    await Promise.resolve();
    expect(config.reload).toHaveBeenCalledTimes(1);

    bus.publish(ActionFired.create("open_config"));
    await Promise.resolve();
    expect(opener.openPath).toHaveBeenCalledTimes(1);

    bus.publish(ActionFired.create("open_documentation"));
    await Promise.resolve();
    expect(opener.openUrl).toHaveBeenCalledTimes(1);
  });
});
