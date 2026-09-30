import { describe, expect, it, vi } from "vitest";
import { scrollSelectedListItemIntoView } from "./scroll-selected-list-item";

describe("scrollSelectedListItemIntoView", () => {
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
