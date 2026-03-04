import { describe, it, expect } from "vitest";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalStateManager } from "./terminal-state.manager";
import { ShellType } from "../../../config/+models/config";
import { getDestroyRef } from "../../../../__test__/test-factory";
import {ConfigService} from "../../../config/+state/config.service";
import {Config} from "../../../config/+models/config";
import {Observable} from "rxjs";
import {ShellProfile} from "../../../config/+models/shell-config";
import {PromptSegment} from "../../../config/+models/prompt-config";

class ConfigServiceMockForNotificationBadge extends ConfigService {
    constructor(private readonly notificationBadgeEnabledState: { value: boolean }) {
        super();
    }

    get config(): Config {
        return {
            notification: {
                mark_terminal: this.notificationBadgeEnabledState.value
            }
        } as Config;
    }

    get config$(): Observable<Config> {
        throw new Error("Not used in this test.");
    }

    getShellProfileOrDefault(_name?: string): ShellProfile {
        throw new Error("Not used in this test.");
    }

    getPromptSegments(): PromptSegment[] {
        return [];
    }
}

describe("TerminalStateManager", () => {
    it("should keep only the focused terminal state manager focused", () => {
        const bus = new AppBus();
        const firstTerminalStateManager = new TerminalStateManager(bus, undefined, undefined, getDestroyRef());
        const secondTerminalStateManager = new TerminalStateManager(bus, undefined, undefined, getDestroyRef());

        firstTerminalStateManager.initialize("terminal-1", "Bash" as ShellType);
        secondTerminalStateManager.initialize("terminal-2", "Bash" as ShellType);

        bus.publish({ type: "FocusTerminal", payload: "terminal-1", path: ["app", "terminal"] });
        expect(firstTerminalStateManager.isFocused).toBe(true);
        expect(secondTerminalStateManager.isFocused).toBe(false);

        bus.publish({ type: "FocusTerminal", payload: "terminal-2", path: ["app", "terminal"] });
        expect(firstTerminalStateManager.isFocused).toBe(false);
        expect(secondTerminalStateManager.isFocused).toBe(true);
    });

    it("should set and clear unread notification state", () => {
        const bus = new AppBus();
        const terminalStateManager = new TerminalStateManager(bus, undefined, undefined, getDestroyRef());
        terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

        expect(terminalStateManager.hasUnreadNotification).toBe(false);
        terminalStateManager.markUnreadNotification();
        expect(terminalStateManager.hasUnreadNotification).toBe(true);
        terminalStateManager.clearUnreadNotification();
        expect(terminalStateManager.hasUnreadNotification).toBe(false);
    });

    it("should not mark unread notification when notification.mark_terminal is false", () => {
        const bus = new AppBus();
        const notificationBadgeEnabledState = {value: false};
        const configService = new ConfigServiceMockForNotificationBadge(notificationBadgeEnabledState);
        const terminalStateManager = new TerminalStateManager(
            bus,
            undefined,
            undefined,
            getDestroyRef(),
            configService
        );
        terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

        terminalStateManager.markUnreadNotification();

        expect(terminalStateManager.hasUnreadNotification).toBe(false);
    });

    it("should clear unread notification on ConfigLoaded when mark_terminal is switched to false", () => {
        const bus = new AppBus();
        const notificationBadgeEnabledState = {value: true};
        const configService = new ConfigServiceMockForNotificationBadge(notificationBadgeEnabledState);
        const terminalStateManager = new TerminalStateManager(
            bus,
            undefined,
            undefined,
            getDestroyRef(),
            configService
        );
        terminalStateManager.initialize("terminal-1", "Bash" as ShellType);

        terminalStateManager.markUnreadNotification();
        expect(terminalStateManager.hasUnreadNotification).toBe(true);

        notificationBadgeEnabledState.value = false;
        bus.publish({type: "ConfigLoaded", path: ["app", "settings"]});

        expect(terminalStateManager.hasUnreadNotification).toBe(false);
    });
});
