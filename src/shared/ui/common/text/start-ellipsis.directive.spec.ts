import { ElementRef, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartEllipsisDirective } from "./start-ellipsis.directive";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("StartEllipsisDirective visibility", () => {
  let intersection: (entries: Partial<IntersectionObserverEntry>[]) => void;
  let resize: () => void;
  let frame: FrameRequestCallback | undefined;
  let disconnect: ReturnType<typeof vi.fn>;
  let directive: StartEllipsisDirective;
  let label: HTMLElement;
  const text = signal("long command");

  beforeEach(() => {
    disconnect = vi.fn();
    frame = undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersection) {
          intersection = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn(() => {
        frame = undefined;
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    label = document.createElement("span");
    directive = TestBed.runInInjectionContext(
      () => new StartEllipsisDirective(new ElementRef(label)),
    );
    text.set("long command");
    directive.appStartEllipsis = text as unknown as typeof directive.appStartEllipsis;
    directive.ngAfterViewInit();
    frame = undefined;
  });

  afterEach(() => {
    directive.ngOnDestroy();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it("measures only visible labels, including updated text when scrolled into view", () => {
    const truncated = vi.fn();
    directive.appStartEllipsisTruncated.subscribe(truncated);
    const measure = vi.fn(() => (label.textContent?.length ?? 0) * 10);
    Object.defineProperty(label, "scrollWidth", { get: measure });
    Object.defineProperty(label, "clientWidth", { get: () => 60 });

    intersection([{ isIntersecting: false }]);
    resize();
    expect(frame).toBeUndefined();
    expect(measure).not.toHaveBeenCalled();

    text.set("updated command");
    intersection([{ isIntersecting: true }]);
    frame?.(0);
    expect(label.textContent).toBe("…mmand");
    expect(truncated).toHaveBeenCalledWith(true);

    measure.mockClear();
    frame = undefined;
    intersection([{ isIntersecting: false }]);
    resize();
    expect(frame).toBeUndefined();
    expect(measure).not.toHaveBeenCalled();
    directive.ngOnDestroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("shows the plain updated text while the row is outside the viewport", () => {
    const measure = vi.fn(() => 0);
    Object.defineProperty(label, "scrollWidth", { get: measure });
    intersection([{ isIntersecting: false }]);
    text.set("updated command");
    TestBed.tick();
    expect(label.textContent).toBe("updated command");
    expect(measure).not.toHaveBeenCalled();
  });

  it("skips pending measurements if the row leaves the viewport", () => {
    const measure = vi.fn(() => 100);
    Object.defineProperty(label, "scrollWidth", { get: measure });
    intersection([{ isIntersecting: true }]);
    intersection([{ isIntersecting: false }]);
    frame?.(0);
    expect(measure).not.toHaveBeenCalled();
  });
});
