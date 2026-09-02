import { OsPlatform } from "@cogno/platform/os";
import { AppWindow } from "@cogno/platform/window";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppButtonsService } from "./+state/app-buttons.service";
import { AppButtonsComponent } from "./app-buttons.component";

const osStub = { platform: () => "linux" } as unknown as OsPlatform;

describe("AppButtonsComponent", () => {
  let component: AppButtonsComponent;
  let service: AppButtonsService;
  let windowSize$: Subject<{ width: number; height: number }>;
  let busMock: any;
  let destroyRefMock: any;
  let appWindowStub: AppWindow;
  let isMaximizedSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowSize$ = new Subject();
    appWindowStub = {
      windowSize$,
      isMaximized: vi.fn().mockResolvedValue(false),
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      unmaximize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppWindow;
    isMaximizedSpy = vi.mocked(appWindowStub.isMaximized);

    busMock = {
      publish: vi.fn(),
      on$: vi.fn(),
    };

    destroyRefMock = {
      onDestroy: vi.fn(),
    };

    // Instantiate real service with mocked dependencies
    service = new AppButtonsService(appWindowStub, destroyRefMock, busMock);

    // Instantiate component with the real service
    component = new AppButtonsComponent(service, osStub);
  });

  it("should call service.closeWindow when close is called", () => {
    const spy = vi.spyOn(service, "closeWindow");
    component.close();
    expect(spy).toHaveBeenCalled();
  });

  it("should call service.minimizeWindow when minimize is called", () => {
    const spy = vi.spyOn(service, "minimizeWindow");
    component.minimize();
    expect(spy).toHaveBeenCalled();
  });

  describe("toggleMaximize", () => {
    it("should call service.maximizeWindow when not maximized", async () => {
      // Ensure initial state is not maximized
      isMaximizedSpy.mockResolvedValue(false);

      // We need to trigger a windowSize$ emission to update service state
      windowSize$.next({ width: 100, height: 100 });
      // Wait for async update in service
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(service.isMaximized()).toBe(false);

      const spyMaximize = vi.spyOn(service, "maximizeWindow");

      component.toggleMaximize();

      expect(spyMaximize).toHaveBeenCalled();
    });

    it("should call service.unmaximizeWindow when maximized", async () => {
      // Set maximized state
      isMaximizedSpy.mockResolvedValue(true);

      // Trigger update
      windowSize$.next({ width: 100, height: 100 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(service.isMaximized()).toBe(true);

      const spyUnmaximize = vi.spyOn(service, "unmaximizeWindow");

      component.toggleMaximize();

      expect(spyUnmaximize).toHaveBeenCalled();
    });
  });
});
