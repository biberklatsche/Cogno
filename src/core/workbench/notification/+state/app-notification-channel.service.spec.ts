import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNotificationChannelService } from "./app-notification-channel.service";

describe("AppNotificationChannelService", () => {
  let appNotificationChannelService: AppNotificationChannelService;

  beforeEach(() => {
    vi.useFakeTimers();
    appNotificationChannelService = new AppNotificationChannelService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function dispatch(header: string, durationSeconds: number | string = 10): void {
    appNotificationChannelService.dispatch({
      notification: { header },
      settings: { duration_seconds: durationSeconds },
    });
  }

  function phase(): string | undefined {
    return appNotificationChannelService.appNotificationToast()?.phase;
  }

  it("walks a toast through its phases and removes it after the configured duration", () => {
    dispatch("Done", 1);
    expect(phase()).toBe("enter");

    vi.advanceTimersByTime(450);
    expect(phase()).toBe("open");

    vi.advanceTimersByTime(999);
    expect(phase()).toBe("open");

    vi.advanceTimersByTime(1);
    expect(phase()).toBe("closing");

    vi.advanceTimersByTime(340);
    expect(phase()).toBe("exit");

    vi.advanceTimersByTime(220);
    expect(appNotificationChannelService.appNotificationToast()).toBeUndefined();
  });

  it("keeps an unlimited toast until it is dismissed", () => {
    dispatch("Stay", "unlimited");

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(phase()).toBe("open");

    appNotificationChannelService.dismissAppNotificationToast();
    expect(phase()).toBe("closing");

    vi.advanceTimersByTime(340 + 220);
    expect(appNotificationChannelService.appNotificationToast()).toBeUndefined();
  });

  it("shows no toast for a duration of 0", () => {
    dispatch("Never", 0);

    expect(appNotificationChannelService.appNotificationToast()).toBeUndefined();
  });

  it("defaults the type to info", () => {
    dispatch("Plain");

    expect(appNotificationChannelService.appNotificationToast()?.type).toBe("info");
  });

  it("lets a new notification take over the open pill and restarts its duration", () => {
    dispatch("One", 1);
    vi.advanceTimersByTime(450 + 900);
    const first = appNotificationChannelService.appNotificationToast();

    dispatch("Two", 1);
    const second = appNotificationChannelService.appNotificationToast();

    expect(second).toMatchObject({ header: "Two", phase: "open", pillId: first?.pillId });
    expect(second?.id).not.toBe(first?.id);

    vi.advanceTimersByTime(999);
    expect(phase()).toBe("open");
    vi.advanceTimersByTime(1);
    expect(phase()).toBe("closing");
  });

  it("opens a pill on time when a notification takes it over during its entrance", () => {
    dispatch("One");
    vi.advanceTimersByTime(200);

    dispatch("Two");

    expect(appNotificationChannelService.appNotificationToast()).toMatchObject({
      header: "Two",
      phase: "enter",
    });
    vi.advanceTimersByTime(250);
    expect(phase()).toBe("open");
  });

  it("reopens a closing pill for a new notification", () => {
    dispatch("One", 1);
    vi.advanceTimersByTime(450 + 1000 + 100);
    const closing = appNotificationChannelService.appNotificationToast();
    expect(closing?.phase).toBe("closing");

    dispatch("Two", 1);

    expect(appNotificationChannelService.appNotificationToast()).toMatchObject({
      header: "Two",
      phase: "open",
      pillId: closing?.pillId,
    });
    // The pending step of the closing pill must not carry the new toast away.
    vi.advanceTimersByTime(340);
    expect(phase()).toBe("open");
  });

  it("starts a new pill when the shown one is already leaving", () => {
    dispatch("One", 1);
    vi.advanceTimersByTime(450 + 1000 + 340);
    const leaving = appNotificationChannelService.appNotificationToast();
    expect(leaving?.phase).toBe("exit");

    dispatch("Two", 1);
    const next = appNotificationChannelService.appNotificationToast();

    expect(next).toMatchObject({ header: "Two", phase: "enter", pillId: next?.id });
    expect(next?.pillId).not.toBe(leaving?.pillId);
    vi.advanceTimersByTime(220);
    expect(appNotificationChannelService.appNotificationToast()?.header).toBe("Two");
  });

  it("ignores a dismissal while the toast is already going", () => {
    dispatch("One", "unlimited");
    vi.advanceTimersByTime(450);
    appNotificationChannelService.dismissAppNotificationToast();
    vi.advanceTimersByTime(300);

    appNotificationChannelService.dismissAppNotificationToast();

    vi.advanceTimersByTime(40);
    expect(phase()).toBe("exit");
  });
});
