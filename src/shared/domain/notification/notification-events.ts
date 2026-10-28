/**
 * Reading a source's events out of the configuration, the one way every
 * source does it: `notification.source.<source>.<event>.enabled`, and the
 * event's own settings next to it.
 */
type EventSettings = { readonly enabled?: boolean } & Readonly<Record<string, unknown>>;

export function notificationEventSettings(
  configuration: Readonly<Record<string, unknown>> | undefined,
  sourceId: string,
  eventId: string,
): EventSettings | undefined {
  const notification = configuration?.["notification"] as
    | { readonly source?: Readonly<Record<string, Readonly<Record<string, EventSettings>>>> }
    | undefined;
  return notification?.source?.[sourceId]?.[eventId];
}

/** Whether the event notifies; off until the config says otherwise. */
export function isNotificationEventEnabled(
  configuration: Readonly<Record<string, unknown>> | undefined,
  sourceId: string,
  eventId: string,
): boolean {
  return notificationEventSettings(configuration, sourceId, eventId)?.enabled ?? false;
}

/** The config key of an event's switch, for writing it. */
export function notificationEventKey(sourceId: string, eventId: string): string {
  return `notification.source.${sourceId}.${eventId}.enabled`;
}
