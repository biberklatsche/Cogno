import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "./logger";
import { NotificationOs } from "./notification";

const notificationPluginMock = vi.hoisted(() => ({
  isPermissionGranted: vi.fn<() => Promise<boolean>>(),
  requestPermission: vi.fn<() => Promise<"granted" | "denied" | "prompt" | "default">>(),
  sendNotification:
    vi.fn<(notification: { readonly title: string; readonly body?: string }) => void>(),
}));

vi.mock("@tauri-apps/plugin-notification", () => notificationPluginMock);
vi.mock("./logger", () => ({
  Logger: {
    error: vi.fn<(message: string) => void>(),
  },
}));

describe("NotificationOs", () => {
  beforeEach(() => {
    notificationPluginMock.isPermissionGranted.mockReset();
    notificationPluginMock.requestPermission.mockReset();
    notificationPluginMock.sendNotification.mockReset();
    vi.mocked(Logger.error).mockReset();
  });

  it("sends an OS notification when permission is granted", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(true);

    const result = await NotificationOs.send("Build completed", "All tests passed");

    expect(result).toEqual({ status: "sent" });
    expect(notificationPluginMock.requestPermission).not.toHaveBeenCalled();
    expect(notificationPluginMock.sendNotification).toHaveBeenCalledWith({
      title: "Build completed",
      body: "All tests passed",
    });
  });

  it("returns permission-denied when the permission request is rejected", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(false);
    notificationPluginMock.requestPermission.mockResolvedValue("denied");

    const result = await NotificationOs.send("Build completed", "All tests passed");

    expect(result).toEqual({ status: "skipped", reason: "permission-denied" });
    expect(notificationPluginMock.sendNotification).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("checks OS notification permission on every send attempt", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(false);
    notificationPluginMock.requestPermission
      .mockResolvedValueOnce("denied")
      .mockResolvedValueOnce("granted");

    const firstResult = await NotificationOs.send("First", "Denied");
    const secondResult = await NotificationOs.send("Second", "Granted");

    expect(firstResult).toEqual({ status: "skipped", reason: "permission-denied" });
    expect(secondResult).toEqual({ status: "sent" });
    expect(notificationPluginMock.isPermissionGranted).toHaveBeenCalledTimes(2);
    expect(notificationPluginMock.requestPermission).toHaveBeenCalledTimes(2);
    expect(notificationPluginMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(notificationPluginMock.sendNotification).toHaveBeenCalledWith({
      title: "Second",
      body: "Granted",
    });
  });
});
