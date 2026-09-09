import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { Opener } from "@cogno/platform/opener";

/**
 * Handles the config-related catalogue actions: open the config file, open the
 * documentation, reload the config. These used to live on ConfigBootstrapAdapter
 * in app/; with the action catalogue they belong to the workbench.
 */
@Injectable({ providedIn: "root" })
export class ConfigActionsHandler {
  constructor(
    actions: ActionHandlers,
    config: ConfigService,
    opener: Opener,
    environment: Environment,
  ) {
    actions.handle("open_config", () => {
      void opener.openPath(environment.configFilePath());
    });
    actions.handle("open_documentation", () => {
      void opener.openUrl("https://cogno.rocks/docs/getting-started/");
    });
    actions.handle("load_config", () => {
      void config.reload();
    });
  }
}
