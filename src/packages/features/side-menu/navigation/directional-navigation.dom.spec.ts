import type { ElementRef } from "@angular/core";
import { describe, expect, it, vi } from "vitest";
import {
  collectDirectionalNavigationItems,
  scrollSelectedListItemIntoView,
} from "./directional-navigation.dom";

describe("directional-navigation.dom", () => {
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
    ] as ReadonlyArray<ElementRef<HTMLElement>>);

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

  it("scrolls the selected list item into view when the index is valid", () => {
    const scrollIntoView = vi.fn();
    const listElement = {
      children: {
        item: vi.fn().mockReturnValue({ scrollIntoView }),
      },
    } as unknown as HTMLUListElement;

    scrollSelectedListItemIntoView(listElement, 1);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("returns early when the list is missing or the index is negative", () => {
    const listElement = {
      children: {
        item: vi.fn(),
      },
    } as unknown as HTMLUListElement;

    scrollSelectedListItemIntoView(undefined, 1);
    scrollSelectedListItemIntoView(listElement, -1);

    expect(listElement.children.item).not.toHaveBeenCalled();
  });
});
