import {
  NotificationOs,
  OsNotificationClickListener,
  OsNotificationTarget,
} from "@cogno/app-tauri/notification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../app-bus/app-bus";
import { OsNotificationChannelService } from "./os-notification-channel.service";

vi.mock("@cogno/app-tauri/notification", () => ({
  NotificationOs: {
    send: vi.fn<
      (title: string, body?: string, target?: OsNotificationTarget) => Promise<unknown>
    >(),
  },
  OsNotificationClickListener: {
    register:
      vi.fn<
        (listener: (target: OsNotificationTarget | undefined) => void) => Promise<() => void>
      >(),
  },
}));

describe("OsNotificationChannelService", () => {
  let appBus: AppBus;
  let osNotificationChannelService: OsNotificationChannelService;

  beforeEach(() => {
    appBus = new AppBus();
    vi.mocked(NotificationOs.send).mockReset();
    vi.mocked(OsNotificationClickListener.register).mockReset();
    vi.mocked(OsNotificationClickListener.register).mockResolvedValue(() => {});
    osNotificationChannelService = new OsNotificationChannelService(appBus);
  });

  it("forwards the notification target to the OS notification", async () => {
    vi.mocked(NotificationOs.send).mockResolvedValue({ status: "sent" });
    const target = { workspaceId: "workspace-1", tabId: "tab-1", terminalId: "terminal-1" };

    await osNotificationChannelService.dispatch({
      notification: {
        header: "Build completed",
        body: "All tests passed",
        target,
      },
      settings: {},
    });

    expect(NotificationOs.send).toHaveBeenCalledWith("Build completed", "All tests passed", target);
  });

  it("publishes OpenNotificationTarget when an OS notification is clicked", () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    const clickListener = vi.mocked(OsNotificationClickListener.register).mock.calls[0]?.[0];
    const target = { workspaceId: "workspace-1", tabId: "tab-1", terminalId: "terminal-1" };

    clickListener?.(target);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "notification"],
        type: "OpenNotificationTarget",
        payload: target,
      }),
    );
  });

  it("ignores OS notification clicks without a target", () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    const clickListener = vi.mocked(OsNotificationClickListener.register).mock.calls[0]?.[0];

    clickListener?.(undefined);

    expect(publishSpy).not.toHaveBeenCalled();
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
