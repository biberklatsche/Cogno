import { z } from "zod";
import { ErrorReportingSettingsSchema } from "./error-reporting-settings";

export const NotificationSettingsSchema = z.object({
  channel: z
    .object({
      app: z
        .object({
          available: z
            .boolean()
            .optional()
            .describe("Whether in-app notifications may be used at all."),
          enabled: z.boolean().optional().describe("Show notifications inside Cogno."),
          duration_seconds: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("How long an in-app notification stays before it fades; 0 keeps it."),
        })
        .optional()
        .describe("In-app notification toasts."),
      os: z
        .object({
          available: z
            .boolean()
            .optional()
            .describe("Whether OS notifications may be used at all."),
          enabled: z.boolean().optional().describe("Send notifications to the operating system."),
        })
        .optional()
        .describe("Desktop notifications handed to the operating system."),
    })
    .optional()
    .describe("Where notifications are delivered."),
  exception: ErrorReportingSettingsSchema.optional().describe(
    "Whether errors raise a notification.",
  ),
});
