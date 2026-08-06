import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "./logger";
import { NotificationOs, OsNotificationClickListener } from "./notification";

const invokeMock = vi.hoisted(() => vi.fn<(command: string, args?: unknown) => Promise<unknown>>());

const listenMock = vi.hoisted(() =>
  vi.fn<(event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>>(),
);

const notificationPluginMock = vi.hoisted(() => ({
  isPermissionGranted: vi.fn<() => Promise<boolean>>(),
  requestPermission: vi.fn<() => Promise<"granted" | "denied" | "prompt" | "default">>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ listen: listenMock }),
}));
vi.mock("@tauri-apps/plugin-notification", () => notificationPluginMock);
vi.mock("./logger", () => ({
  Logger: {
    error: vi.fn<(message: string) => void>(),
  },
}));

describe("NotificationOs", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    notificationPluginMock.isPermissionGranted.mockReset();
    notificationPluginMock.requestPermission.mockReset();
    vi.mocked(Logger.error).mockReset();
  });

  it("sends an OS notification when permission is granted", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(true);

    const result = await NotificationOs.send("Build completed", "All tests passed");

    expect(result).toEqual({ status: "sent" });
    expect(notificationPluginMock.requestPermission).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("send_os_notification", {
      title: "Build completed",
      body: "All tests passed",
      target: undefined,
    });
  });

  it("passes the click target to the notification command", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(true);
    const target = { workspaceId: "workspace-1", tabId: "tab-1", terminalId: "terminal-1" };

    const result = await NotificationOs.send("Build completed", "All tests passed", target);

    expect(result).toEqual({ status: "sent" });
    expect(invokeMock).toHaveBeenCalledWith("send_os_notification", {
      title: "Build completed",
      body: "All tests passed",
      target,
    });
  });

  it("returns permission-denied when the permission request is rejected", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(false);
    notificationPluginMock.requestPermission.mockResolvedValue("denied");

    const result = await NotificationOs.send("Build completed", "All tests passed");

    expect(result).toEqual({ status: "skipped", reason: "permission-denied" });
    expect(invokeMock).not.toHaveBeenCalled();
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
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("send_os_notification", {
      title: "Second",
      body: "Granted",
      target: undefined,
    });
  });

  it("returns failed when the notification command rejects", async () => {
    notificationPluginMock.isPermissionGranted.mockResolvedValue(true);
    const error = new Error("toast failure");
    invokeMock.mockRejectedValue(error);

    const result = await NotificationOs.send("Build completed");

    expect(result).toEqual({ status: "failed", error });
    expect(Logger.error).toHaveBeenCalled();
  });
});

describe("OsNotificationClickListener", () => {
  beforeEach(() => {
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {});
  });

  it("forwards a valid click target to the listener", async () => {
    const listener = vi.fn();

    await OsNotificationClickListener.register(listener);

    const handler = listenMock.mock.calls[0]?.[1];
    expect(listenMock).toHaveBeenCalledWith("os-notification-clicked", expect.any(Function));
    handler?.({ payload: { workspaceId: "workspace-1", tabId: "tab-1" } });
    expect(listener).toHaveBeenCalledWith({ workspaceId: "workspace-1", tabId: "tab-1" });
  });

  it("forwards undefined when the payload is not a valid target", async () => {
    const listener = vi.fn();

    await OsNotificationClickListener.register(listener);

    const handler = listenMock.mock.calls[0]?.[1];
    handler?.({ payload: { workspaceId: "workspace-1" } });
    handler?.({ payload: null });
    expect(listener).toHaveBeenNthCalledWith(1, undefined);
    expect(listener).toHaveBeenNthCalledWith(2, undefined);
  });
});
