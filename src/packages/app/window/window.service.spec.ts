import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { appWindowMock } = vi.hoisted(() => ({
  appWindowMock: {
    isFocused: vi.fn().mockResolvedValue(true),
    isVisible: vi.fn().mockResolvedValue(true),
    isMaximized: vi.fn().mockResolvedValue(false),
    isMinimized: vi.fn().mockResolvedValue(false),
    setFocus: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
    unminimize: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    windowSize$: undefined as unknown,
    onCloseRequested$: undefined as unknown,
    onFocusChanged$: undefined as unknown,
    onDragDrop$: undefined as unknown,
  },
}));

vi.mock("@cogno/app-tauri/window-core", () => ({
  WindowCore: {
    newWindow: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@cogno/app-tauri/window", () => ({
  AppWindow: appWindowMock,
}));

vi.mock("@cogno/app-tauri/process", () => ({
  Process: {
    exit: vi.fn(() => Promise.resolve()),
    relaunch: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@cogno/app-tauri/os", () => ({
  OS: {
    platform: vi.fn(() => "macos"),
  },
}));

import { Logger } from "@cogno/app-tauri/logger";
import { Process } from "@cogno/app-tauri/process";
import { AppWindow } from "@cogno/app-tauri/window";
import { WindowCore } from "@cogno/app-tauri/window-core";
import {
  clear,
  getAppBus,
  getTerminalBusyStateService,
  getWindowService,
} from "../../__test__/test-factory";
import { ActionFired, type ActionFiredEvent } from "../action/action.models";
import type { AppBus } from "../app-bus/app-bus";
import type { TerminalBusyStateService } from "../terminal/terminal-busy-state.service";
import type { WindowService } from "./window.service";

describe("WindowService", () => {
  let service: WindowService;
  let bus: AppBus;
  let terminalBusyStateService: TerminalBusyStateService;

  beforeEach(() => {
    appWindowMock.windowSize$ = new Subject<{ width: number; height: number }>();
    appWindowMock.onCloseRequested$ = new Subject<any>();
    appWindowMock.onFocusChanged$ = new Subject<boolean>();
    appWindowMock.onDragDrop$ = new Subject<any>();
    bus = getAppBus();
    terminalBusyStateService = getTerminalBusyStateService();
    vi.spyOn(bus, "publish");
    service = getWindowService();
  });

  afterEach(() => {
    clear();
    vi.clearAllMocks();
  });

  function createActionEvent(
    actionName: "quit" | "new_window" | "close_window",
    args?: string[],
  ): ActionFiredEvent {
    return ActionFired.create(actionName, undefined, args);
  }

  it("should be created and publish InitConfigCommand", () => {
    expect(service).toBeTruthy();
    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "InitConfigCommand" }),
    );
  });

  describe("ActionFired events", () => {
    it("should handle quit action", async () => {
      const event = createActionEvent("quit");
      bus.publish(event);

      await vi.waitFor(() => {
        expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith(
          "quit the application",
        );
        expect(Process.exit).toHaveBeenCalled();
        expect(event.performed).toBe(true);
      });
    });

    it("should handle new_window action", async () => {
      const event = createActionEvent("new_window");
      bus.publish(event);

      await vi.waitFor(() => {
        expect(WindowCore.newWindow).toHaveBeenCalledWith();
        expect(event.performed).toBe(true);
      });
    });

    it("should handle close_window action", async () => {
      const event = createActionEvent("close_window", ["workspace_saved"]);
      bus.publish(event);

      await vi.waitFor(() => {
        expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith(
          "close the application window",
        );
        expect(AppWindow.close).toHaveBeenCalled();
        expect(event.performed).toBe(true);
      });
    });

    it("should not quit when busy terminals block the action", async () => {
      vi.mocked(terminalBusyStateService.confirmProceedIfNoBusyTerminals).mockResolvedValue(false);
      const event = createActionEvent("quit");
      bus.publish(event);

      await vi.waitFor(() => {
        expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith(
          "quit the application",
        );
      });

      expect(Process.exit).not.toHaveBeenCalled();
      expect(event.performed).not.toBe(true);
    });

    it("should not close the window when busy terminals block the action", async () => {
      vi.mocked(terminalBusyStateService.confirmProceedIfNoBusyTerminals).mockResolvedValue(false);
      const event = createActionEvent("close_window", ["workspace_saved"]);
      bus.publish(event);

      await vi.waitFor(() => {
        expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith(
          "close the application window",
        );
      });

      expect(AppWindow.close).not.toHaveBeenCalled();
      expect(event.performed).not.toBe(true);
    });

    it("should report an error if new_window fails", async () => {
      vi.mocked(WindowCore.newWindow).mockRejectedValueOnce(new Error("Failed"));
      const event = createActionEvent("new_window");
      bus.publish(event);

      await vi.waitFor(() => {
        expect(event.performed).toBe(true);
      });

      expect(Logger.error).toHaveBeenCalled();
    });
  });

  describe("onCloseRequested$", () => {
    it("should publish close_window when window close is requested", () => {
      (AppWindow.onCloseRequested$ as Subject<any>).next({ preventDefault: vi.fn() });

      expect(bus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ActionFired",
          path: ["app", "action"],
          payload: "close_window",
        }),
      );
    });
  });
});
