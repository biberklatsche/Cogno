import { NotificationOs } from "@cogno/app-tauri/notification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../app-bus/app-bus";
import { OsNotificationChannelService } from "./os-notification-channel.service";

vi.mock("@cogno/app-tauri/notification", () => ({
  NotificationOs: {
    send: vi.fn<(title: string, body?: string) => Promise<unknown>>(),
  },
}));

describe("OsNotificationChannelService", () => {
  let appBus: AppBus;
  let osNotificationChannelService: OsNotificationChannelService;

  beforeEach(() => {
    appBus = new AppBus();
    osNotificationChannelService = new OsNotificationChannelService(appBus);
    vi.mocked(NotificationOs.send).mockReset();
  });

  it("publishes a warning notification when OS permission is denied", async () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    vi.mocked(NotificationOs.send).mockResolvedValue({
      status: "skipped",
      reason: "permission-denied",
    });

    await osNotificationChannelService.dispatch({
      notification: {
        header: "Build completed",
        body: "All tests passed",
      },
      settings: {},
    });

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["notification"],
        type: "Notification",
        payload: expect.objectContaining({
          header: "OS notifications disabled",
          body: "Enable notifications for Cogno in your operating system settings.",
          type: "warning",
          channels: {
            app: true,
            os: false,
          },
        }),
      }),
    );
  });

  it("does not publish a warning notification after a successful OS notification", async () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    vi.mocked(NotificationOs.send).mockResolvedValue({ status: "sent" });

    await osNotificationChannelService.dispatch({
      notification: {
        header: "Build completed",
      },
      settings: {},
    });

    expect(publishSpy).not.toHaveBeenCalled();
  });
});
