import { z } from "zod";

export const AutocompleteSettingsSchema = z.strictObject({
  provider: z
    .strictObject({
      timeout_ms: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Maximum time in milliseconds for one dynamic autocomplete provider."),
    })
    .optional(),
});
