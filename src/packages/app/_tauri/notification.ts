import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
} from "@tauri-apps/plugin-notification";
import {Logger} from "./logger";

type PermissionState = "granted" | "denied" | "prompt" | "default";

export type OsNotificationSendResult =
    | { readonly status: "sent" }
    | { readonly status: "skipped"; readonly reason: "missing-title" | "permission-denied" }
    | { readonly status: "failed"; readonly error: unknown };

export class NotificationOs {
    static async send(title: string, body?: string): Promise<OsNotificationSendResult> {
        if (!title?.trim()) {
            return { status: "skipped", reason: "missing-title" };
        }
        try {
            const allowed = await this.ensurePermission({
                isPermissionGranted,
                requestPermission,
            });
            if (!allowed) {
                return { status: "skipped", reason: "permission-denied" };
            }
            sendNotification({
                title: title.trim(),
                body: body?.trim() || undefined,
            });
            return { status: "sent" };
        } catch (error) {
            Logger.error(`[NotificationOs] OS notification failed: ${String(error)}`);
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
            Logger.error(`[NotificationOs] permission check failed: ${String(error)}`);
            return false;
        }
    }
}
