import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNotificationChannelService } from "./app-notification-channel.service";

describe("AppNotificationChannelService", () => {
  let appNotificationChannelService: AppNotificationChannelService;

  beforeEach(() => {
    appNotificationChannelService = new AppNotificationChannelService();
  });

  it("creates and dismisses app toasts after the configured duration", () => {
    vi.useFakeTimers();

    appNotificationChannelService.dispatch({
      notification: {
        header: "Done",
      },
      settings: {
        duration_seconds: 1,
      },
    });

    expect(appNotificationChannelService.appNotificationToasts()).toHaveLength(1);

    vi.advanceTimersByTime(1000);

    expect(appNotificationChannelService.appNotificationToasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("keeps an unlimited toast until it is dismissed", () => {
    vi.useFakeTimers();
    appNotificationChannelService.dispatch({
      notification: { header: "Stay" },
      settings: { duration_seconds: "unlimited" },
    });

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(appNotificationChannelService.appNotificationToasts()).toHaveLength(1);

    const [toast] = appNotificationChannelService.appNotificationToasts();
    appNotificationChannelService.dismissAppNotificationToast(toast.id);
    expect(appNotificationChannelService.appNotificationToasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("shows no toast for a duration of 0", () => {
    appNotificationChannelService.dispatch({
      notification: { header: "Never" },
      settings: { duration_seconds: 0 },
    });

    expect(appNotificationChannelService.appNotificationToasts()).toHaveLength(0);
  });

  it("keeps only the latest three app toasts", () => {
    appNotificationChannelService.dispatch({
      notification: { header: "One" },
      settings: { duration_seconds: 10 },
    });
    appNotificationChannelService.dispatch({
      notification: { header: "Two" },
      settings: { duration_seconds: 10 },
    });
    appNotificationChannelService.dispatch({
      notification: { header: "Three" },
      settings: { duration_seconds: 10 },
    });
    appNotificationChannelService.dispatch({
      notification: { header: "Four" },
      settings: { duration_seconds: 10 },
    });

    expect(
      appNotificationChannelService.appNotificationToasts().map((toast) => toast.header),
    ).toEqual(["Two", "Three", "Four"]);
  });
});
