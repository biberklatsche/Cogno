import { ElementRef } from "@angular/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipDirective } from "./tooltip.directive";

/**
 * Pins the hover tooltip against a host that moves away from under the
 * pointer, as a tab does while the strip reorders live: the tooltip must
 * neither appear for nor stay on a host the pointer is no longer over.
 */
describe("TooltipDirective", () => {
  let host: HTMLElement;
  let hovered: boolean;
  let directive: TooltipDirective;

  const tooltip = () => document.body.querySelector("div[style*='position: fixed']");

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("button");
    document.body.appendChild(host);
    hovered = true;
    vi.spyOn(host, "matches").mockImplementation((selector) => selector === ":hover" && hovered);
    directive = new TooltipDirective(new ElementRef(host));
    directive.text = "Shell";
  });

  afterEach(() => {
    directive.ngOnDestroy();
    host.remove();
    vi.useRealTimers();
  });

  it("shows the tooltip after the hover delay and removes it when the pointer leaves", () => {
    directive.onMouseEnter();
    vi.advanceTimersByTime(800);
    expect(tooltip()).not.toBeNull();

    directive.onMouseLeave();
    expect(tooltip()).toBeNull();
  });

  it("does not show a tooltip for a host that moved away from under the pointer meanwhile", () => {
    directive.onMouseEnter();
    hovered = false;

    vi.advanceTimersByTime(800);

    expect(tooltip()).toBeNull();
  });

  it("removes a shown tooltip once the pointer moves and the host is no longer hovered", () => {
    directive.onMouseEnter();
    vi.advanceTimersByTime(800);

    document.dispatchEvent(new MouseEvent("mousemove"));
    expect(tooltip()).not.toBeNull();

    hovered = false;
    document.dispatchEvent(new MouseEvent("mousemove"));
    expect(tooltip()).toBeNull();
  });

  it("stops watching the pointer once the tooltip is gone", () => {
    directive.onMouseEnter();
    vi.advanceTimersByTime(800);
    directive.onMouseLeave();
    const matches = host.matches as ReturnType<typeof vi.fn>;
    matches.mockClear();

    document.dispatchEvent(new MouseEvent("mousemove"));

    expect(matches).not.toHaveBeenCalled();
  });

  it("drops the pending or shown tooltip on a press", () => {
    directive.onMouseEnter();
    directive.onMouseDown();
    vi.advanceTimersByTime(800);
    expect(tooltip()).toBeNull();

    directive.onMouseEnter();
    vi.advanceTimersByTime(800);
    directive.onMouseDown();
    expect(tooltip()).toBeNull();
  });

  it("leaves a manually shown tooltip to its owner", () => {
    directive.tooltipVisible = true;
    directive.ngOnChanges({ tooltipVisible: { currentValue: true } } as never);
    vi.advanceTimersByTime(150);
    expect(tooltip()).not.toBeNull();

    hovered = false;
    document.dispatchEvent(new MouseEvent("mousemove"));
    directive.onMouseDown();

    expect(tooltip()).not.toBeNull();
  });
});
