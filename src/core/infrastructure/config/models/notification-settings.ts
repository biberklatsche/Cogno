import { limitSchema } from "@cogno/shared/contributions";
import { z } from "zod";
import { ErrorReportingSettingsSchema } from "./error-reporting-settings";

export const NotificationSettingsSchema = z.strictObject({
  channel: z
    .strictObject({
      app: z
        .strictObject({
          available: z
            .boolean()
            .optional()
            .describe("Whether in-app notifications may be used at all."),
          enabled: z.boolean().optional().describe("Show notifications inside Cogno."),
          duration_seconds: limitSchema()
            .optional()
            .describe(
              "Seconds an in-app notification stays before it fades. `unlimited` keeps it until you dismiss it; 0 shows none.",
            ),
        })
        .optional()
        .describe("In-app notification toasts."),
      os: z
        .strictObject({
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
