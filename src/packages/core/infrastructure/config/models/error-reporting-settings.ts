import { z } from "zod";

export const ErrorReportingSettingsSchema = z.object({
  handled: z
    .object({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Show a notification for handled exceptions reported through the central error reporter.",
        ),
    })
    .optional(),
  unhandled: z
    .object({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Show a notification for unhandled renderer exceptions caught by the global error reporter.",
        ),
    })
    .optional(),
});
