import { FeatureModeContract, NotificationChannelContract } from "@cogno/shared/domain";
import { ApplicationSettingsExtensionContract } from "./application-settings-extension";
import { DatabaseMigrationContract } from "./database-migration";
import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition";

/**
 * An action a feature declares. The name is known from the declaration phase
 * on (so CLI, HTTP and the palette can offer it); the handler is registered
 * when the feature is activated.
 */
export interface FeatureActionContract<TActionName = string> {
  readonly actionName: TActionName;
}

/**
 * Everything a feature contributes to the application. One optional field
 * per extension point; the app collects the definitions listed in
 * `app/features.ts` and wires each field to its consumer.
 */
export interface FeatureDefinition<TActionName = string> {
  readonly id: string;
  /**
   * The feature's default mode; the config's `feature.<id>.mode` overrides it.
   * Every feature has one - what has no mode lives in `core/` (ARCHITECTURE.md
   * decision 4).
   */
  readonly mode: FeatureModeContract;
  /**
   * What the feature points at (ARCHITECTURE.md 6, axis 1). Its lifetime is
   * always the application; `target` only says whether it acts on a session or
   * on the workbench.
   */
  readonly target: "session" | "workbench";
  /**
   * Other features this one needs; resolved transitively by the feature-host
   * before activation. Unknown or cyclic requires abort the start.
   */
  readonly requires?: ReadonlyArray<string>;
  /** Schema steps, applied on startup in list order. */
  readonly migrations?: ReadonlyArray<DatabaseMigrationContract>;
  /** Action names the feature owns; known from declaration, handled on activation. */
  readonly actions?: ReadonlyArray<FeatureActionContract<TActionName>>;
  /** Side-menu entries with panel component and lifecycle. */
  readonly sideMenu?: ReadonlyArray<SideMenuFeatureDefinitionContract<TActionName>>;
  /** Zod schema extension and defaults for the configuration reader. */
  readonly settings?: ApplicationSettingsExtensionContract;
  /** Additional notification channels. */
  readonly notificationChannels?: ReadonlyArray<NotificationChannelContract>;
}
