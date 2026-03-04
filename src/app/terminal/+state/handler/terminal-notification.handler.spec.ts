import { describe, it, expect, vi, beforeEach } from "vitest";
import { Terminal } from "@xterm/xterm";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { TerminalNotificationHandler } from "./terminal-notification.handler";

describe("TerminalNotificationHandler", () => {
    let handler: TerminalNotificationHandler;
    let mockTerminal: Terminal;
    let mockBus: AppBus;

    beforeEach(() => {
        mockBus = new AppBus();
        handler = new TerminalNotificationHandler(mockBus);
        mockTerminal = TerminalMockFactory.createTerminal();
    });

    it("registers OSC handler for 9", () => {
        handler.registerTerminal(mockTerminal);
        expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(9, expect.any(Function));
    });

    it("publishes Notification when OSC 9 is received", () => {
        const publishSpy = vi.spyOn(mockBus, "publish");
        handler.registerTerminal(mockTerminal);

        const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls.find(call =>
            call[0] === 9
        )![1];

        const result = oscHandler("Build completed successfully");

        expect(result).toBe(true);
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: "Notification",
            path: ["notification"],
            payload: expect.objectContaining({
                header: "Terminal Notification",
                body: "Build completed successfully",
                type: "info",
            })
        }));
    });

    it("ignores empty OSC 9 payloads", () => {
        const publishSpy = vi.spyOn(mockBus, "publish");
        handler.registerTerminal(mockTerminal);
        const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls.find(call =>
            call[0] === 9
        )![1];

        const result = oscHandler("   \n\r   ");

        expect(result).toBe(true);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it("disposes registered handlers", () => {
        const disposeSpy = vi.fn();
        vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
        handler.registerTerminal(mockTerminal);

        handler.dispose();

        expect(disposeSpy).toHaveBeenCalledTimes(1);
    });
});
