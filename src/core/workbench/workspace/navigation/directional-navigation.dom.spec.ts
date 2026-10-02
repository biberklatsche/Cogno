import type { ElementRef } from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import { collectDirectionalNavigationItems } from "./directional-navigation.dom";

describe("collectDirectionalNavigationItems", () => {
  it("collects navigation ids and element rectangles from element refs", () => {
    const firstElement = {
      dataset: { navigationId: "first" },
      getBoundingClientRect: vi.fn(() => ({
        top: 10,
        right: 110,
        bottom: 50,
        left: 10,
        width: 100,
        height: 40,
      })),
    };
    const secondElement = {
      dataset: {},
      getBoundingClientRect: vi.fn(),
    };

    const items = collectDirectionalNavigationItems([
      { nativeElement: firstElement },
      { nativeElement: secondElement },
    ] as unknown as ReadonlyArray<ElementRef<HTMLElement>>);

    expect(items).toEqual([
      {
        id: "first",
        rect: {
          top: 10,
          right: 110,
          bottom: 50,
          left: 10,
          width: 100,
          height: 40,
        },
      },
    ]);
    expect(secondElement.getBoundingClientRect).not.toHaveBeenCalled();
  });
});
