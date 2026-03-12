import {DestroyRef} from "@angular/core";
import {Subject} from "rxjs";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {TerminalFileDropService} from "./terminal-file-drop.service";
import {AppWindow} from "../_tauri/window";
import {TerminalSession} from "./+state/terminal.session";

describe("TerminalFileDropService", () => {
    let service: TerminalFileDropService;
    let terminalSession: Pick<TerminalSession, "focus" | "insertPaths">;
    let destroyRef: DestroyRef;
    let dragDrop$: Subject<any>;

    beforeEach(() => {
        dragDrop$ = new Subject();
        AppWindow.onDragDrop$ = dragDrop$ as any;
        vi.spyOn(AppWindow, "setFocus").mockResolvedValue();

        terminalSession = {
            focus: vi.fn(),
            insertPaths: vi.fn(),
        };

        destroyRef = {
            onDestroy: () => () => undefined,
            destroyed: false,
        };

        service = new TerminalFileDropService(destroyRef, terminalSession as TerminalSession);
    });

    it("should insert dropped paths from native tauri drop events over the terminal host", async () => {
        vi.useFakeTimers();
        const hostElement = {
            getBoundingClientRect: () => ({left: 10, top: 20, right: 210, bottom: 220}),
        } as HTMLDivElement;
        try {
            service.initialize(hostElement);

            dragDrop$.next({
                type: "drop",
                position: {x: 40, y: 80},
                paths: ["C:\\temp\\file.txt"],
            });

            expect(terminalSession.insertPaths).toHaveBeenCalledWith(["C:\\temp\\file.txt"]);
            await Promise.resolve();
            expect(AppWindow.setFocus).toHaveBeenCalled();
            vi.runAllTimers();
            expect(terminalSession.focus).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it("should ignore native drops outside the terminal host", () => {
        const hostElement = {
            getBoundingClientRect: () => ({left: 10, top: 20, right: 210, bottom: 220}),
        } as HTMLDivElement;
        service.initialize(hostElement);

        dragDrop$.next({
            type: "drop",
            position: {x: 500, y: 500},
            paths: ["C:\\temp\\file.txt"],
        });

        expect(AppWindow.setFocus).not.toHaveBeenCalled();
        expect(terminalSession.focus).not.toHaveBeenCalled();
        expect(terminalSession.insertPaths).not.toHaveBeenCalled();
    });
});
