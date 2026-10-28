import type { NotificationChannelContract } from "@cogno/shared/domain";
import { describe, expect, it } from "vitest";
import type { AppNotificationChannelService } from "./app-notification-channel.service";
import type { BadgeNotificationChannelService } from "./badge-notification-channel.service";
import { NotificationChannelRegistry } from "./notification-channel-registry";
import type { OsNotificationChannelService } from "./os-notification-channel.service";

function channel(id: string): NotificationChannelContract {
  return { id, displayName: id, sortOrder: 0, dispatch: () => {} } as NotificationChannelContract;
}

function makeRegistry(): NotificationChannelRegistry {
  return new NotificationChannelRegistry(
    channel("app") as unknown as AppNotificationChannelService,
    channel("os") as unknown as OsNotificationChannelService,
    channel("badge") as unknown as BadgeNotificationChannelService,
  );
}

describe("NotificationChannelRegistry", () => {
  it("always carries the built-in app, OS and badge channels", () => {
    const registry = makeRegistry();

    expect(registry.getChannels().map((c) => c.id)).toEqual(["app", "os", "badge"]);
  });

  it("adds and removes feature channels", () => {
    const registry = makeRegistry();

    registry.register(channel("slack"));
    expect(registry.getChannels().map((c) => c.id)).toContain("slack");

    registry.unregister("slack");
    expect(registry.getChannels().map((c) => c.id)).not.toContain("slack");
  });
});
