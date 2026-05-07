import { signal } from "@angular/core";
import type { NotificationTargetContract } from "@cogno/core-api";
import { describe, expect, it, vi } from "vitest";
import type { AppBus } from "../app-bus/app-bus";
import type { AppNotificationChannelService } from "./+state/app-notification-channel.service";
import type { AppNotificationToast } from "./+state/app-notification-toast.models";
import { AppNotificationToastStackComponent } from "./app-notification-toast-stack.component";

describe("AppNotificationToastStackComponent", () => {
  it("dismisses toasts through the notification channel service", () => {
    const appNotificationChannelService: Pick<
      AppNotificationChannelService,
      "appNotificationToasts" | "dismissAppNotificationToast"
    > = {
      appNotificationToasts: signal<AppNotificationToast[]>([]),
      dismissAppNotificationToast: vi.fn(),
    };
    const appBus: Pick<AppBus, "publish"> = {
      publish: vi.fn(),
    };
    const component = new AppNotificationToastStackComponent(
      appNotificationChannelService as AppNotificationChannelService,
      appBus as AppBus,
    );

    component.dismiss(17);

    expect(appNotificationChannelService.dismissAppNotificationToast).toHaveBeenCalledWith(17);
  });

  it("publishes notification targets and resolves icons by type", () => {
    const target: NotificationTargetContract = { workspaceId: "workspace-1" };
    const appNotificationChannelService: Pick<
      AppNotificationChannelService,
      "appNotificationToasts" | "dismissAppNotificationToast"
    > = {
      appNotificationToasts: signal<AppNotificationToast[]>([]),
      dismissAppNotificationToast: vi.fn(),
    };
    const appBus: Pick<AppBus, "publish"> = {
      publish: vi.fn(),
    };
    const component = new AppNotificationToastStackComponent(
      appNotificationChannelService as AppNotificationChannelService,
      appBus as AppBus,
    );

    component.openTarget({
      id: 1,
      header: "Open target",
      type: "info",
      timestamp: new Date(),
      target,
    });

    expect(appBus.publish).toHaveBeenCalledWith({
      path: ["app", "notification"],
      type: "OpenNotificationTarget",
      payload: target,
    });
    expect(component.getIcon("success")).toBe("mdiCheckCircle");
    expect(component.getIcon("warning")).toBe("mdiAlert");
    expect(component.getIcon("error")).toBe("mdiAlert");
    expect(component.getIcon()).toBe("mdiInformation");
  });

  it("ignores missing targets", () => {
    const appNotificationChannelService: Pick<
      AppNotificationChannelService,
      "appNotificationToasts" | "dismissAppNotificationToast"
    > = {
      appNotificationToasts: signal<AppNotificationToast[]>([]),
      dismissAppNotificationToast: vi.fn(),
    };
    const appBus: Pick<AppBus, "publish"> = {
      publish: vi.fn(),
    };
    const component = new AppNotificationToastStackComponent(
      appNotificationChannelService as AppNotificationChannelService,
      appBus as AppBus,
    );

    component.openTarget({
      id: 2,
      header: "No target",
      type: "info",
      timestamp: new Date(),
    });

    expect(appBus.publish).not.toHaveBeenCalled();
  });
});
