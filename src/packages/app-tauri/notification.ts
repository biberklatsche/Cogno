import { invoke } from "@tauri-apps/api/core";
import { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { Logger } from "./logger";

type PermissionState = "granted" | "denied" | "prompt" | "default";

const OS_NOTIFICATION_CLICKED_EVENT = "os-notification-clicked";

export interface OsNotificationTarget {
  readonly workspaceId: string;
  readonly tabId: string;
  readonly terminalId?: string;
  readonly label?: string;
}

export type OsNotificationSendResult =
  | { readonly status: "sent" }
  | { readonly status: "skipped"; readonly reason: "missing-title" | "permission-denied" }
  | { readonly status: "failed"; readonly error: unknown };

export class NotificationOs {
  static async send(
    title: string,
    body?: string,
    target?: OsNotificationTarget,
  ): Promise<OsNotificationSendResult> {
    if (!title?.trim()) {
      return { status: "skipped", reason: "missing-title" };
    }
    try {
      const allowed = await NotificationOs.ensurePermission({
        isPermissionGranted,
        requestPermission,
      });
      if (!allowed) {
        return { status: "skipped", reason: "permission-denied" };
      }
      await invoke("send_os_notification", {
        title: title.trim(),
        body: body?.trim() || undefined,
        target,
      });
      return { status: "sent" };
    } catch (error) {
      Logger.error(`[NotificationOs] Failed to send notification: ${String(error)}`);
      return { status: "failed", error };
    }
  }

  private static async ensurePermission(plugin: {
    isPermissionGranted: () => Promise<boolean>;
    requestPermission: () => Promise<PermissionState>;
  }): Promise<boolean> {
    try {
      let granted = await plugin.isPermissionGranted();
      if (!granted) {
        const permission = await plugin.requestPermission();
        granted = permission === "granted";
      }
      return granted;
    } catch (error) {
      Logger.error(`[NotificationOs] Failed to check notification permission: ${String(error)}`);
      return false;
    }
  }
}

/**
 * Registers a listener for OS notification clicks. The Rust side emits the
 * click target only to the window that sent the notification, so this must
 * listen on the current webview window rather than globally.
 */
export const OsNotificationClickListener = {
  register(listener: (target: OsNotificationTarget | undefined) => void): Promise<UnlistenFn> {
    return getCurrentWebviewWindow().listen<unknown>(
      OS_NOTIFICATION_CLICKED_EVENT,
      ({ payload }) => {
        listener(isOsNotificationTarget(payload) ? payload : undefined);
      },
    );
  },
};

function isOsNotificationTarget(value: unknown): value is OsNotificationTarget {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { readonly workspaceId?: unknown; readonly tabId?: unknown };
  return typeof candidate.workspaceId === "string" && typeof candidate.tabId === "string";
}
