import { signal } from "@angular/core";
import type { NotificationCenterItemContract, NotificationTargetContract } from "@cogno/core-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationCenterStateService } from "./notification-center-state.service";
import { NotificationSideComponent } from "./notification-side.component";

describe("NotificationSideComponent", () => {
  const originalDateNow = Date.now;

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it("delegates remove, clear and open target actions to the state service", () => {
    const target: NotificationTargetContract = { workspaceId: "workspace-1" };
    const notificationCenterStateService: Pick<
      NotificationCenterStateService,
      "notifications" | "remove" | "clear" | "openTarget"
    > = {
      notifications: signal<NotificationCenterItemContract[]>([]),
      remove: vi.fn(),
      clear: vi.fn(),
      openTarget: vi.fn(),
    };
    const component = new NotificationSideComponent(
      notificationCenterStateService as NotificationCenterStateService,
    );

    component.remove("notification-1");
    component.clearAll();
    component.openTarget({
      id: "notification-1",
      header: "Open target",
      type: "info",
      timestamp: new Date(),
      count: 1,
      target,
    });
    component.openTarget({
      id: "notification-2",
      header: "Ignore target",
      type: "info",
      timestamp: new Date(),
      count: 1,
    });

    expect(notificationCenterStateService.remove).toHaveBeenCalledWith("notification-1");
    expect(notificationCenterStateService.clear).toHaveBeenCalledTimes(1);
    expect(notificationCenterStateService.openTarget).toHaveBeenCalledTimes(1);
    expect(notificationCenterStateService.openTarget).toHaveBeenCalledWith(target);
  });

  it("formats relative timestamps across all display buckets", () => {
    Date.now = vi.fn(() => new Date("2026-05-07T12:00:00.000Z").getTime());

    const component = new NotificationSideComponent({
      notifications: signal<NotificationCenterItemContract[]>([]),
      remove: vi.fn(),
      clear: vi.fn(),
      openTarget: vi.fn(),
    } as NotificationCenterStateService);

    expect(component.toRelativeTime(new Date("2026-05-07T11:59:45.000Z"))).toBe("just now");
    expect(component.toRelativeTime(new Date("2026-05-07T11:55:00.000Z"))).toBe("5m ago");
    expect(component.toRelativeTime(new Date("2026-05-07T10:00:00.000Z"))).toBe("2h ago");
    expect(component.toRelativeTime(new Date("2026-05-05T12:00:00.000Z"))).toBe("2d ago");
  });
});
