import { NotificationSourceContract } from "@cogno/core/api/contributions";
import { defaultSettings } from "./models/default-config-values";

/** Raw default values as the config file spells them: strings, nested by key. */
export type DefaultTree = { readonly [key: string]: string | DefaultTree };

/**
 * Every default: what core owns (`default-config-values.ts`) plus what the
 * notification sources declare - each event off, its own settings at their
 * declared default. The generated default config, the reference and the
 * settings panel all read this, so a declared event cannot lack a default.
 */
export function composeDefaultSettings(
  sources: ReadonlyArray<NotificationSourceContract>,
): DefaultTree {
  const source: Record<string, DefaultTree> = {};
  for (const notificationSource of sources) {
    const events: Record<string, DefaultTree> = {};
    for (const event of notificationSource.events) {
      const settings: Record<string, string> = { enabled: "false" };
      for (const [key, setting] of Object.entries(event.settings ?? {})) {
        settings[key] = setting.default;
      }
      events[event.id] = settings;
    }
    source[notificationSource.id] = events;
  }
  return { ...defaultSettings, notification: { ...defaultSettings.notification, source } };
}
