import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@cogno/app-tauri/window", () => ({
  AppWindow: appWindowMock,
}));

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { AppWindow } from "@cogno/app-tauri/window";
import { AppButtonsService } from "./app-buttons.service";

describe("AppButtonsService", () => {
  let service: AppButtonsService;
  let windowSize$: Subject<{ width: number; height: number }>;
  let busMock: any;
  let destroyRefMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    windowSize$ = new Subject();
    appWindowMock.windowSize$ = windowSize$;
    appWindowMock.onCloseRequested$ = new Subject();
    appWindowMock.onFocusChanged$ = new Subject<boolean>();
    appWindowMock.onDragDrop$ = new Subject();

    busMock = {
      publish: vi.fn(),
      on$: vi.fn(),
    };

    destroyRefMock = {
      onDestroy: vi.fn(),
    };

    service = new AppButtonsService(destroyRefMock, busMock);
  });

  it("should initialize isMaximized based on AppWindow.isMaximized when windowSize$ emits", async () => {
    vi.spyOn(AppWindow, "isMaximized").mockResolvedValue(true);

    windowSize$.next({ width: 1024, height: 768 });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.isMaximized()).toBe(true);
    expect(AppWindow.isMaximized).toHaveBeenCalled();
  });

  it("should publish close_window action when closeWindow is called", () => {
    service.closeWindow();

    expect(busMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ActionFired",
        payload: "close_window",
      }),
    );
  });

  it("should call AppWindow.minimize when minimizeWindow is called", () => {
    service.minimizeWindow();
    expect(AppWindow.minimize).toHaveBeenCalled();
  });

  it("should call AppWindow.maximize when maximizeWindow is called", () => {
    service.maximizeWindow();
    expect(AppWindow.maximize).toHaveBeenCalled();
  });

  it("should call AppWindow.unmaximize when unmaximizeWindow is called", () => {
    service.unmaximizeWindow();
    expect(AppWindow.unmaximize).toHaveBeenCalled();
  });
});
