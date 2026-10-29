import type { SessionState } from "../host/session-host";

const PANEL_ITEM_HEIGHT_PX = 25;
const PANEL_MAX_VISIBLE_ITEMS = 6;
const PANEL_OUTER_PADDING_AND_BORDER = 10;
export const DROPDOWN_PANEL_MIN_WIDTH = 280;
const DROPDOWN_PANEL_MAX_WIDTH = 920;

type DropdownPlacement = "below" | "above";

export type DropdownPosition = {
  x: number;
  y: number;
  width: number;
  placement: DropdownPlacement;
};

/**
 * The input line as the dropdowns watch it. NUL separates the fields because
 * it cannot occur in the input text; a printable separator would let two
 * different inputs share a signature and a panel would miss the change.
 */
export function inputSignature(state: Pick<SessionState, "input">): string {
  const input = state.input;
  return `${input.text}\u0000${input.cursorIndex}\u0000${input.maxCursorIndex}`;
}

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

/**
 * Where a dropdown anchored at the session's cursor goes and how wide it is.
 * The width follows the widest item (`itemWidthPx`, given the estimated pixel
 * width of a label character) and is bounded by the window minus the
 * right-side overlays, never by the pane.
 */
export function positionDropdownPanel<T>(input: {
  state: Pick<SessionState, "dimensions" | "cursorPosition">;
  hostRect?: DOMRect;
  items: readonly T[];
  itemWidthPx: (item: T, labelCharPx: number) => number;
  /** What the panel shows below its list, in px. */
  footerPx: number;
  measuredPanelHeight?: number | null;
}): DropdownPosition {
  const { dimensions, cursorPosition } = input.state;
  const cellWidth = Math.max(1, dimensions.cellWidth || 9);
  const cellHeight = Math.max(1, dimensions.cellHeight || 18);
  const fallbackViewportWidth = Math.max(cellWidth, dimensions.cols * cellWidth);
  const viewportWidth = Math.max(cellWidth, dimensions.viewportWidth || fallbackViewportWidth);
  const windowWidth = Math.max(
    1,
    window.innerWidth || document.documentElement.clientWidth || viewportWidth,
  );
  const windowHeight = Math.max(
    1,
    window.innerHeight || document.documentElement.clientHeight || cellHeight,
  );
  const bounds = resolveBoundsRect(windowWidth, windowHeight);
  const effectiveRight = Math.max(
    bounds.left + 16,
    bounds.right - resolveRightUiInset(windowWidth),
  );
  const availableWidth = Math.max(240, effectiveRight - bounds.left);

  const labelCharPx = Math.max(6, Math.floor(cellWidth * 0.95));
  const widestItemPx = input.items.reduce(
    (max, item) => Math.max(max, input.itemWidthPx(item, labelCharPx)),
    0,
  );
  const desiredWidth = widestItemPx + PANEL_OUTER_PADDING_AND_BORDER;
  const estimatedPanelWidth = Math.max(
    DROPDOWN_PANEL_MIN_WIDTH,
    Math.min(availableWidth - 8, Math.min(DROPDOWN_PANEL_MAX_WIDTH, desiredWidth)),
  );

  return computeDropdownPanelPosition({
    col: cursorPosition.viewport.col,
    row: cursorPosition.viewport.row,
    cellWidth,
    cellHeight,
    hostRect: input.hostRect,
    windowWidth,
    windowHeight,
    estimatedPanelWidth,
    estimatedPanelHeight: estimateDropdownPanelHeight(
      input.items.length,
      cellHeight,
      input.footerPx,
    ),
    measuredPanelHeight: input.measuredPanelHeight,
  });
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
