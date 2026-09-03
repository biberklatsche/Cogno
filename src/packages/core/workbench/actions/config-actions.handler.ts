import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { Opener } from "@cogno/platform/opener";

/**
 * Handles the config-related catalogue actions: open the config file, open the
 * documentation, reload the config. These used to live on ConfigBootstrapAdapter
 * in app/; with the action catalogue they belong to the workbench.
 */
@Injectable({ providedIn: "root" })
export class ConfigActionsHandler {
  constructor(
    appBus: AppBus,
    config: ConfigService,
    opener: Opener,
    environment: Environment,
    destroyRef: DestroyRef,
  ) {
    appBus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async (event) => {
        if (event.payload === "open_config") {
          await opener.openPath(environment.configFilePath());
        }
        if (event.payload === "open_documentation") {
          await opener.openUrl("https://cogno.rocks/docs/getting-started/");
        }
        if (event.payload === "load_config") {
          await config.reload();
        }
      });
  }
}
