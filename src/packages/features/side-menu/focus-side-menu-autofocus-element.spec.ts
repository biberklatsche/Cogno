import { afterEach, describe, expect, it, vi } from "vitest";
import { focusSideMenuAutofocusElement } from "./focus-side-menu-autofocus-element";

describe("focusSideMenuAutofocusElement", () => {
  const originalDocument = globalThis.document;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    vi.restoreAllMocks();
  });

  it("focuses and selects the autofocus element during the animation frame", () => {
    const focus = vi.fn();
    const select = vi.fn();
    const querySelector = vi.fn().mockReturnValue({ focus, select });

    globalThis.document = { querySelector } as unknown as Document;
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    focusSideMenuAutofocusElement();

    expect(querySelector).toHaveBeenCalledWith("[data-side-menu-autofocus='true']");
    expect(focus).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("returns early when no document is available", () => {
    globalThis.document = undefined as unknown as Document;
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    expect(() => focusSideMenuAutofocusElement()).not.toThrow();
  });
});
