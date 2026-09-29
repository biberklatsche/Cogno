import { ZodRawShape } from "zod";

/**
 * The config keys a feature owns. Default values are not part of it: they live
 * in the generated default config (`default-config-values.ts`), the single
 * source of defaults.
 */
export interface ApplicationSettingsExtensionContract {
  readonly schemaShape: ZodRawShape;
}
