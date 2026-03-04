import {Logger} from "./logger";

type PermissionState = "granted" | "denied" | "prompt" | "default";

export class NotificationOs {
    private static permissionChecked = false;
    private static permissionGranted = false;

    static async send(title: string, body?: string): Promise<void> {
        if (!title?.trim()) return;
        try {
            const plugin = await import("@tauri-apps/plugin-notification");
            const allowed = await this.ensurePermission(plugin);
            if (!allowed) return;
            plugin.sendNotification({
                title: title.trim(),
                body: body?.trim() || undefined,
            });
        } catch (error) {
            Logger.error(`[NotificationOs] OS notification failed: ${String(error)}`);
        }
    }

    private static async ensurePermission(plugin: {
        isPermissionGranted: () => Promise<boolean>;
        requestPermission: () => Promise<PermissionState>;
    }): Promise<boolean> {
        if (this.permissionChecked) return this.permissionGranted;

        try {
            let granted = await plugin.isPermissionGranted();
            if (!granted) {
                const permission = await plugin.requestPermission();
                granted = permission === "granted";
            }
            this.permissionChecked = true;
            this.permissionGranted = granted;
            return granted;
        } catch (error) {
            Logger.error(`[NotificationOs] permission check failed: ${String(error)}`);
            this.permissionChecked = true;
            this.permissionGranted = false;
            return false;
        }
    }
}
