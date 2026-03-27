import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
} from "@tauri-apps/plugin-notification";
import { ErrorReporter } from "../common/error/error-reporter";

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
            ErrorReporter.reportException({
                error,
                handled: true,
                notify: false,
                source: "NotificationOs",
                context: {
                    operation: "send",
                    title: title.trim(),
                },
            });
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
            ErrorReporter.reportException({
                error,
                handled: true,
                notify: false,
                source: "NotificationOs",
                context: {
                    operation: "ensurePermission",
                },
            });
            return false;
        }
    }
}
