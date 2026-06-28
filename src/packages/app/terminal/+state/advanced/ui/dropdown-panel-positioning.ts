const PANEL_ITEM_HEIGHT_PX = 25;
const PANEL_MAX_VISIBLE_ITEMS = 6;
const PANEL_OUTER_PADDING_AND_BORDER = 10;

export type DropdownPlacement = "below" | "above";

export type DropdownPosition = {
  x: number;
  y: number;
  width: number;
  placement: DropdownPlacement;
};

export function resolveBoundsRect(windowWidth: number, windowHeight: number): DOMRect {
  return new DOMRect(0, 0, windowWidth, windowHeight);
}

export function resolveRightUiInset(windowWidth: number): number {
  // Reserve space for visible right side menu UI so dropdowns never render under it.
  const host = document.querySelector("app-side-menu");
  if (!host) return 0;

  const candidates = [
    ...host.querySelectorAll<HTMLElement>("aside:not(.hidden)"),
    ...host.querySelectorAll<HTMLElement>("menu:not(.hidden)"),
  ];

  let maxInset = 0;
  for (const el of candidates) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const inset = Math.max(0, windowWidth - rect.left);
    if (inset > maxInset) maxInset = inset;
  }
  return maxInset;
}

export function estimateDropdownPanelHeight(
  itemCount: number,
  cellHeight: number,
  extraPx: number = 0,
): number {
  const rowHeight = Math.max(PANEL_ITEM_HEIGHT_PX, Math.round(cellHeight * 1.7));
  const visibleRows = Math.max(1, Math.min(PANEL_MAX_VISIBLE_ITEMS, itemCount));
  return PANEL_OUTER_PADDING_AND_BORDER + visibleRows * rowHeight + extraPx;
}

export function computeDropdownPanelPosition(input: {
  col: number;
  row: number;
  cellWidth: number;
  cellHeight: number;
  hostRect?: DOMRect;
  windowWidth: number;
  windowHeight: number;
  estimatedPanelWidth: number;
  estimatedPanelHeight: number;
  measuredPanelHeight?: number | null;
}): DropdownPosition {
  const col = Math.max(1, input.col);
  const row = Math.max(1, input.row);
  const cellWidth = Math.max(1, input.cellWidth);
  const cellHeight = Math.max(1, input.cellHeight);
  const bounds = resolveBoundsRect(input.windowWidth, input.windowHeight);
  const rightUiInset = resolveRightUiInset(input.windowWidth);
  const effectiveRight = Math.max(bounds.left + 16, bounds.right - rightUiInset);

  const cursorX = (input.hostRect?.left ?? 0) + (col - 1) * cellWidth;
  const minX = Math.max(4, bounds.left + 4);
  const maxX = Math.max(minX, effectiveRight - input.estimatedPanelWidth - 4);
  const x = Math.max(minX, Math.min(cursorX, maxX));

  const cursorLineTop = (input.hostRect?.top ?? 0) + (row - 1) * cellHeight;
  const belowY = cursorLineTop + cellHeight + 4;
  const aboveAnchorY = cursorLineTop - cellHeight;
  const minimumTopY = Math.max(4, bounds.top + 4);
  const panelHeight = input.measuredPanelHeight ?? input.estimatedPanelHeight;
  const hasRoomForBelowAnchor = belowY <= bounds.bottom - 4;
  const hasRoomBelow = hasRoomForBelowAnchor && belowY + panelHeight <= bounds.bottom - 4;
  const placement: DropdownPlacement = hasRoomBelow ? "below" : "above";

  let y =
    placement === "below" ? Math.max(minimumTopY, belowY) : Math.max(minimumTopY, aboveAnchorY);

  if (panelHeight > 0) {
    if (placement === "below") {
      const maximumBelowY = Math.max(minimumTopY, bounds.bottom - panelHeight - 4);
      y = Math.min(y, maximumBelowY);
    } else {
      // Above placement uses translateY(-100%), so this anchor must keep panel top within viewport.
      const minimumAboveAnchorY = minimumTopY + panelHeight;
      y = Math.max(y, minimumAboveAnchorY);
    }
  }

  return { x, y, width: input.estimatedPanelWidth, placement };
}
