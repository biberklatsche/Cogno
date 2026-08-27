import { z } from "zod";
import { ErrorReportingSettingsSchema } from "./error-reporting-settings";

export const NotificationSettingsSchema = z.object({
  channel: z
    .object({
      app: z
        .object({
          available: z.boolean().optional(),
          enabled: z.boolean().optional(),
          duration_seconds: z.number().int().min(0).optional(),
        })
        .optional(),
      os: z
        .object({
          available: z.boolean().optional(),
          enabled: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  exception: ErrorReportingSettingsSchema.optional(),
});
