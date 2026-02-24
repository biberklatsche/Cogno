import { describe, it, expect } from "vitest";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalStateManager } from "./terminal-state.manager";
import { ShellType } from "../../../config/+models/config";
import { getDestroyRef } from "../../../../__test__/test-factory";

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
});
