import {
  type DirectionalNavigationItem,
  resolveNextNavigationTarget,
} from "@cogno/features/side-menu/navigation/directional-navigation.engine";
import { describe, expect, it } from "vitest";

function createNavigationItem(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): DirectionalNavigationItem<string> {
  return {
    id,
    rect: {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    },
  };
}

describe("resolveNextNavigationTarget", () => {
  it("moves vertically within an irregular grid using element geometry", () => {
    const items = [
      createNavigationItem("A", 0, 0, 120, 60),
      createNavigationItem("B", 140, 0, 120, 60),
      createNavigationItem("C", 280, 0, 120, 60),
      createNavigationItem("D", 0, 80, 180, 60),
      createNavigationItem("E", 200, 80, 120, 60),
    ];

    const nextId = resolveNextNavigationTarget({
      items,
      activeId: "B",
      direction: "down",
    });

    expect(nextId).toBe("E");
  });

  it("prefers items that visually stay in the same row", () => {
    const items = [
      createNavigationItem("A", 0, 0, 120, 60),
      createNavigationItem("B", 140, 0, 120, 60),
      createNavigationItem("C", 280, 0, 120, 60),
      createNavigationItem("D", 0, 90, 120, 60),
    ];

    const nextId = resolveNextNavigationTarget({
      items,
      activeId: "B",
      direction: "left",
    });

    expect(nextId).toBe("A");
  });

  it("wraps horizontally to the first matching item when no candidate exists in direction", () => {
    const items = [
      createNavigationItem("A", 0, 0, 120, 60),
      createNavigationItem("B", 140, 0, 120, 60),
      createNavigationItem("C", 280, 0, 120, 60),
      createNavigationItem("D", 0, 90, 120, 60),
      createNavigationItem("E", 140, 90, 120, 60),
    ];

    const nextId = resolveNextNavigationTarget({
      items,
      activeId: "C",
      direction: "right",
      wrap: true,
    });

    expect(nextId).toBe("A");
  });
});
