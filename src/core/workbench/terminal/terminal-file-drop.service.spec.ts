import type { DestroyRef } from "@angular/core";
import type { SessionHost } from "@cogno/core/session/host/session-host";
import { AppWindow } from "@cogno/platform/window";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalFileDropService } from "./terminal-file-drop.service";

describe("TerminalFileDropService", () => {
  let service: TerminalFileDropService;
  let terminalSession: Pick<SessionHost, "focus" | "insertPaths">;
  let destroyRef: DestroyRef;
  let appWindowStub: AppWindow;
  let dragDropStream: Subject<unknown>;

  beforeEach(() => {
    dragDropStream = new Subject();
    appWindowStub = {
      onDragDrop$: dragDropStream,
      setFocus: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppWindow;

    terminalSession = {
      focus: vi.fn(),
      insertPaths: vi.fn(),
    };

    destroyRef = {
      onDestroy: () => () => undefined,
      destroyed: false,
    };

    service = new TerminalFileDropService(
      appWindowStub,
      destroyRef,
      terminalSession as SessionHost,
    );
  });

  it("should insert dropped paths from native tauri drop events over the terminal host", async () => {
    vi.useFakeTimers();
    const hostElement = {
      getBoundingClientRect: () => ({ left: 10, top: 20, right: 210, bottom: 220 }),
    } as HTMLDivElement;

    try {
      service.initialize(hostElement);

      dragDropStream.next({
        type: "drop",
        position: { x: 40, y: 80 },
        paths: ["C:\\temp\\file.txt"],
      });

      expect(terminalSession.insertPaths).toHaveBeenCalledWith(["C:\\temp\\file.txt"]);
      await Promise.resolve();
      expect(appWindowStub.setFocus).toHaveBeenCalled();
      vi.runAllTimers();
      expect(terminalSession.focus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should ignore native drops outside the terminal host", () => {
    const hostElement = {
      getBoundingClientRect: () => ({ left: 10, top: 20, right: 210, bottom: 220 }),
    } as HTMLDivElement;

    service.initialize(hostElement);

    dragDropStream.next({
      type: "drop",
      position: { x: 500, y: 500 },
      paths: ["C:\\temp\\file.txt"],
    });

    expect(appWindowStub.setFocus).not.toHaveBeenCalled();
    expect(terminalSession.focus).not.toHaveBeenCalled();
    expect(terminalSession.insertPaths).not.toHaveBeenCalled();
  });
});
