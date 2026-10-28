import { limitSchema, NotificationSourceContract } from "@cogno/core/api/contributions";
import { z } from "zod";

/** Where notifications go; every source uses the same channels. */
const channelSchema = z
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
      .meta({ title: "In-app" })
      .optional()
      .describe("In-app notification toasts."),
    os: z
      .strictObject({
        available: z.boolean().optional().describe("Whether OS notifications may be used at all."),
        enabled: z.boolean().optional().describe("Send notifications to the operating system."),
      })
      .meta({ title: "Operating system" })
      .optional()
      .describe("Desktop notifications handed to the operating system."),
    badge: z
      .strictObject({
        enabled: z
          .boolean()
          .optional()
          .describe(
            "Mark the tab of the terminal a notification belongs to while that terminal isn't focused.",
          ),
      })
      .meta({ title: "Tab badge" })
      .optional()
      .describe("The unread mark on a terminal's tab."),
  })
  .meta({ title: "Channels" })
  .optional()
  .describe("Where notifications are delivered.");

/** One event: `enabled`, plus whatever settings the event declares. */
function eventSchema(event: NotificationSourceContract["events"][number]) {
  return z
    .strictObject({
      enabled: z
        .boolean()
        .optional()
        .describe(event.description ?? event.label),
      ...(event.settings ?? {}),
    })
    .meta({ title: event.label })
    .optional();
}

/**
 * `notification.source.<id>.<event>`, composed from what the sources declare:
 * the schema knows only the sources it was given, so an event of a source
 * nobody declared is an unknown key, like any other typo.
 */
function sourceSchema(sources: ReadonlyArray<NotificationSourceContract>) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const source of sources) {
    const events: Record<string, z.ZodTypeAny> = {};
    for (const event of source.events) events[event.id] = eventSchema(event);
    shape[source.id] = z.strictObject(events).meta({ title: source.label }).optional();
  }
  return z
    .strictObject(shape)
    .meta({ title: "Sources" })
    .optional()
    .describe("Which events of which source notify you.");
}

export function createNotificationSettingsSchema(
  sources: ReadonlyArray<NotificationSourceContract>,
) {
  return z.strictObject({
    channel: channelSchema,
    source: sourceSchema(sources),
  });
}

/**
 * The static shape, for the `Config` type only: `source` is open here because
 * the sources are known at runtime, not at compile time. The schema the
 * config is read with comes from `createNotificationSettingsSchema`.
 */
export const NotificationSettingsSchema = z.strictObject({
  channel: channelSchema,
  source: z
    .record(z.string(), z.record(z.string(), z.looseObject({ enabled: z.boolean().optional() })))
    .optional(),
});
