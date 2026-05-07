import { ApplicationRef, createComponent, EnvironmentInjector } from "@angular/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextMenuOverlayService } from "./context-menu-overlay.service";
import { ContextMenuOverlayComponent } from "./context-menu-overlay.types";

vi.mock("@angular/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@angular/core")>();
  return {
    ...actual,
    createComponent: vi.fn(),
  };
});

type TestOverlayComponent = ContextMenuOverlayComponent & {
  title?: string;
};

describe("ContextMenuOverlayService", () => {
  let service: ContextMenuOverlayService;
  let appRef: Pick<ApplicationRef, "attachView" | "detachView">;
  let environmentInjector: EnvironmentInjector;
  let componentRefMock: {
    instance: TestOverlayComponent;
    hostView: object;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );

    appRef = {
      attachView: vi.fn(),
      detachView: vi.fn(),
    };
    environmentInjector = {} as EnvironmentInjector;
    componentRefMock = {
      instance: {},
      hostView: {},
      destroy: vi.fn(),
    };
    vi.mocked(createComponent).mockReturnValue(componentRefMock as never);

    service = new ContextMenuOverlayService(appRef as ApplicationRef, environmentInjector);
  });

  it("opens, positions and closes overlay components", () => {
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove");
    const ref = service.openAt({ x: 100, y: 50 }, class {} as never, { title: "Menu" });
    const host = document.body.lastElementChild as HTMLDivElement;
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 52,
      width: 40,
      height: 20,
      right: 140,
      bottom: 72,
      x: 100,
      y: 52,
      toJSON: () => ({}),
    });

    expect(ref.isOpen()).toBe(true);
    expect(componentRefMock.instance.title).toBe("Menu");
    expect(appRef.attachView).toHaveBeenCalledWith(componentRefMock.hostView);

    ref.close();

    expect(appRef.detachView).toHaveBeenCalledWith(componentRefMock.hostView);
    expect(componentRefMock.destroy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(ref.isOpen()).toBe(false);
  });

  it("closes when clicking outside or pressing escape", () => {
    const ref = service.openAt({ x: 10, y: 10 }, class {} as never);
    const outsideClickEvent = new PointerEvent("pointerdown", {
      bubbles: true,
      composed: true,
      clientX: 200,
      clientY: 200,
    });
    Object.defineProperty(outsideClickEvent, "timeStamp", { value: 100 });

    document.dispatchEvent(outsideClickEvent);
    expect(ref.isOpen()).toBe(false);

    service.openAt({ x: 10, y: 10 }, class {} as never);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(componentRefMock.destroy).toHaveBeenCalledTimes(2);
  });

  it("supports right alignment and viewport repositioning", () => {
    const ref = service.openAt({ x: 150, y: 150 }, class {} as never, undefined, {
      horizontalAlign: "right",
    });
    const host = document.body.lastElementChild as HTMLDivElement;
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
      left: 150,
      top: 152,
      width: 300,
      height: 300,
      right: 450,
      bottom: 452,
      x: 150,
      y: 152,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 200 });

    service.openAt({ x: 150, y: 150 }, class {} as never, undefined, { horizontalAlign: "right" });

    expect(host.style.left).not.toBe("");
    expect(host.style.top).not.toBe("");
    ref.close();
  });

  it("opens relative to an element rectangle", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      left: 20,
      top: 30,
      right: 80,
      bottom: 90,
      width: 60,
      height: 60,
      x: 20,
      y: 30,
      toJSON: () => ({}),
    });

    const ref = service.openContextForElement(element, undefined, { horizontalAlign: "right" });

    expect(ref.isOpen()).toBe(true);
  });
});
