import type { DestroyRef } from "@angular/core";
import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type {
  NotificationChannelOptionContract,
  NotificationChannelsPort,
} from "@cogno/core/api/notification-channels-port";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { CodingAgentNotificationPreferencesService } from "./coding-agent-notification-preferences.service";

type Config = { feature?: unknown; font?: unknown };

function readyNotifications(enabled: boolean): Config {
  return { feature: { coding_agents: { notifications: { ready: { enabled } } } } };
}

describe("CodingAgentNotificationPreferencesService", () => {
  function makeService(initial: Config) {
    const configuration$ = new BehaviorSubject<Config>(initial);
    let channels: NotificationChannelOptionContract[] = [
      { id: "app", displayName: "App", defaultEnabled: true },
    ];
    const service = new CodingAgentNotificationPreferencesService(
      {
        configuration$,
        getConfiguration: () => configuration$.value,
      } as unknown as ApplicationConfigurationPort,
      { getAvailableChannels: () => channels } as unknown as NotificationChannelsPort,
      { onDestroy: () => () => {} } as unknown as DestroyRef,
    );
    return {
      service,
      configuration$,
      setChannels: (next: NotificationChannelOptionContract[]) => {
        channels = next;
      },
    };
  }

  it("follows a change of the configured notifications", () => {
    const { service, configuration$ } = makeService(readyNotifications(false));
    expect(service.shouldNotify("ready")).toBe(false);

    configuration$.next(readyNotifications(true));

    expect(service.shouldNotify("ready")).toBe(true);
  });

  it("offers a channel that became available", () => {
    const { service, configuration$, setChannels } = makeService(readyNotifications(true));

    setChannels([
      { id: "app", displayName: "App", defaultEnabled: true },
      { id: "os", displayName: "System", defaultEnabled: false },
    ]);
    configuration$.next({ ...readyNotifications(true) });

    expect(service.getChannelOptions().map((channel) => channel.id)).toEqual(["app", "os"]);
  });

  it("keeps what was toggled in the panel when an unrelated setting changes", () => {
    const { service, configuration$ } = makeService(readyNotifications(true));
    service.toggleNotification("ready");
    expect(service.shouldNotify("ready")).toBe(false);

    configuration$.next({ ...readyNotifications(true), font: { size: 14 } });

    expect(service.shouldNotify("ready")).toBe(false);
  });
});
