import { describe, expect, it } from "vitest";
import {
  computeDropdownPanelPosition,
  estimateDropdownPanelHeight,
  resolveBoundsRect,
} from "./dropdown-panel-positioning";

describe("dropdown-panel-positioning", () => {
  describe("resolveBoundsRect", () => {
    it("returns a rect spanning the given window size", () => {
      const bounds = resolveBoundsRect(800, 600);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
      expect(bounds.right).toBe(800);
      expect(bounds.bottom).toBe(600);
    });
  });

  describe("estimateDropdownPanelHeight", () => {
    it("caps visible rows at the max and adds extra padding", () => {
      const height = estimateDropdownPanelHeight(20, 18, 38);
      // rowHeight = max(25, round(18*1.7)) = max(25, 31) = 31; visibleRows capped at 6
      expect(height).toBe(10 + 6 * 31 + 38);
    });

    it("uses at least one visible row for an empty list", () => {
      const height = estimateDropdownPanelHeight(0, 18, 0);
      expect(height).toBe(10 + 1 * 31);
    });
  });

  describe("computeDropdownPanelPosition", () => {
    it("places the panel below the cursor when there is room", () => {
      const position = computeDropdownPanelPosition({
        col: 5,
        row: 2,
        cellWidth: 9,
        cellHeight: 18,
        hostRect: { left: 0, top: 0 } as DOMRect,
        windowWidth: 1000,
        windowHeight: 800,
        estimatedPanelWidth: 280,
        estimatedPanelHeight: 100,
      });

      expect(position.placement).toBe("below");
      expect(position.width).toBe(280);
      expect(position.x).toBeGreaterThanOrEqual(4);
    });

    it("places the panel above the cursor when there isn't room below", () => {
      const position = computeDropdownPanelPosition({
        col: 5,
        row: 40,
        cellWidth: 9,
        cellHeight: 18,
        hostRect: { left: 0, top: 0 } as DOMRect,
        windowWidth: 1000,
        windowHeight: 800,
        estimatedPanelWidth: 280,
        estimatedPanelHeight: 100,
      });

      expect(position.placement).toBe("above");
    });

    it("clamps x within the window bounds for a cursor near the right edge", () => {
      const position = computeDropdownPanelPosition({
        col: 200,
        row: 2,
        cellWidth: 9,
        cellHeight: 18,
        hostRect: { left: 0, top: 0 } as DOMRect,
        windowWidth: 500,
        windowHeight: 800,
        estimatedPanelWidth: 280,
        estimatedPanelHeight: 100,
      });

      expect(position.x).toBeLessThanOrEqual(500 - 280 - 4);
    });

    it("prefers measuredPanelHeight over estimatedPanelHeight when given", () => {
      const withEstimate = computeDropdownPanelPosition({
        col: 5,
        row: 2,
        cellWidth: 9,
        cellHeight: 18,
        windowWidth: 1000,
        windowHeight: 100,
        estimatedPanelWidth: 280,
        estimatedPanelHeight: 10,
      });
      const withMeasured = computeDropdownPanelPosition({
        col: 5,
        row: 2,
        cellWidth: 9,
        cellHeight: 18,
        windowWidth: 1000,
        windowHeight: 100,
        estimatedPanelWidth: 280,
        estimatedPanelHeight: 10,
        measuredPanelHeight: 90,
      });

      expect(withMeasured.placement).not.toBe(withEstimate.placement);
    });
  });
});
