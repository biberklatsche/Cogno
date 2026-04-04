import type { ZodRawShape } from "zod";
import type { ApplicationSettingsSectionDefinitionContract } from "./application-settings-section-definition.contract";

export interface ApplicationSettingsExtensionContract {
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly schemaShape: ZodRawShape;
  readonly settingsSections: ReadonlyArray<ApplicationSettingsSectionDefinitionContract>;
}


