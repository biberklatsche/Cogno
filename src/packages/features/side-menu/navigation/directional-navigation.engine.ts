import { SelectionDirection } from "@cogno/core-domain";

export interface NavigationRect {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface DirectionalNavigationItem<TId extends string = string> {
  readonly id: TId;
  readonly rect: NavigationRect;
  readonly disabled?: boolean;
}

export interface ResolveNextNavigationTargetOptions<TId extends string = string> {
  readonly activeId?: TId | null;
  readonly direction: SelectionDirection;
  readonly items: ReadonlyArray<DirectionalNavigationItem<TId>>;
  readonly wrap?: boolean;
}

type ResolvedNavigationItem<TId extends string> = DirectionalNavigationItem<TId> & {
  readonly centerX: number;
  readonly centerY: number;
};

const AXIS_EPSILON = 0.5;

export function resolveNextNavigationTarget<TId extends string>(
  options: ResolveNextNavigationTargetOptions<TId>,
): TId | null {
  const items = options.items
    .filter((item) => !item.disabled)
    .filter((item) => item.rect.width > 0 && item.rect.height > 0)
    .map(toResolvedNavigationItem);

  if (items.length === 0) {
    return null;
  }

  const activeItem = items.find((item) => item.id === options.activeId) ?? items[0];
  const directionalCandidates = items.filter(
    (item) => item.id !== activeItem.id && isCandidateInDirection(activeItem, item, options.direction),
  );

  const nextItem =
    selectBestDirectionalCandidate(activeItem, directionalCandidates, options.direction) ??
    (options.wrap ? selectWrapCandidate(activeItem, items, options.direction) : null);

  return nextItem?.id ?? activeItem.id;
}

function toResolvedNavigationItem<TId extends string>(
  item: DirectionalNavigationItem<TId>,
): ResolvedNavigationItem<TId> {
  return {
    ...item,
    centerX: item.rect.left + item.rect.width / 2,
    centerY: item.rect.top + item.rect.height / 2,
  };
}

function isCandidateInDirection<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  candidate: ResolvedNavigationItem<TId>,
  direction: SelectionDirection,
): boolean {
  if (direction === "right") {
    return candidate.centerX > activeItem.centerX + AXIS_EPSILON;
  }
  if (direction === "left") {
    return candidate.centerX < activeItem.centerX - AXIS_EPSILON;
  }
  if (direction === "down") {
    return candidate.centerY > activeItem.centerY + AXIS_EPSILON;
  }
  return candidate.centerY < activeItem.centerY - AXIS_EPSILON;
}

function selectBestDirectionalCandidate<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  candidates: ReadonlyArray<ResolvedNavigationItem<TId>>,
  direction: SelectionDirection,
): ResolvedNavigationItem<TId> | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((firstCandidate, secondCandidate) =>
    compareDirectionalCandidates(activeItem, firstCandidate, secondCandidate, direction),
  )[0];
}

function compareDirectionalCandidates<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  firstCandidate: ResolvedNavigationItem<TId>,
  secondCandidate: ResolvedNavigationItem<TId>,
  direction: SelectionDirection,
): number {
  const firstMetrics = getDirectionalMetrics(activeItem, firstCandidate, direction);
  const secondMetrics = getDirectionalMetrics(activeItem, secondCandidate, direction);

  return (
    compareBoolean(secondMetrics.hasCrossAxisOverlap, firstMetrics.hasCrossAxisOverlap) ||
    compareNumber(firstMetrics.primaryDistance, secondMetrics.primaryDistance) ||
    compareNumber(firstMetrics.crossAxisDistance, secondMetrics.crossAxisDistance) ||
    compareNumber(firstMetrics.euclideanDistance, secondMetrics.euclideanDistance) ||
    compareNumber(firstMetrics.anchor, secondMetrics.anchor)
  );
}

function getDirectionalMetrics<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  candidate: ResolvedNavigationItem<TId>,
  direction: SelectionDirection,
) {
  const primaryDistance =
    direction === "right"
      ? candidate.centerX - activeItem.centerX
      : direction === "left"
        ? activeItem.centerX - candidate.centerX
        : direction === "down"
          ? candidate.centerY - activeItem.centerY
          : activeItem.centerY - candidate.centerY;

  const crossAxisDistance =
    direction === "right" || direction === "left"
      ? Math.abs(candidate.centerY - activeItem.centerY)
      : Math.abs(candidate.centerX - activeItem.centerX);

  const hasCrossAxisOverlap =
    direction === "right" || direction === "left"
      ? rangesOverlap(activeItem.rect.top, activeItem.rect.bottom, candidate.rect.top, candidate.rect.bottom)
      : rangesOverlap(activeItem.rect.left, activeItem.rect.right, candidate.rect.left, candidate.rect.right);

  const euclideanDistance = Math.hypot(candidate.centerX - activeItem.centerX, candidate.centerY - activeItem.centerY);
  const anchor =
    direction === "right"
      ? candidate.rect.left
      : direction === "left"
        ? -candidate.rect.right
        : direction === "down"
          ? candidate.rect.top
          : -candidate.rect.bottom;

  return {
    primaryDistance,
    crossAxisDistance,
    hasCrossAxisOverlap,
    euclideanDistance,
    anchor,
  };
}

function selectWrapCandidate<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  items: ReadonlyArray<ResolvedNavigationItem<TId>>,
  direction: SelectionDirection,
): ResolvedNavigationItem<TId> | null {
  const wrapCandidates = items.filter((item) => item.id !== activeItem.id);
  if (wrapCandidates.length === 0) {
    return null;
  }

  return [...wrapCandidates].sort((firstCandidate, secondCandidate) =>
    compareWrapCandidates(activeItem, firstCandidate, secondCandidate, direction),
  )[0];
}

function compareWrapCandidates<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  firstCandidate: ResolvedNavigationItem<TId>,
  secondCandidate: ResolvedNavigationItem<TId>,
  direction: SelectionDirection,
): number {
  const firstMetrics = getWrapMetrics(activeItem, firstCandidate, direction);
  const secondMetrics = getWrapMetrics(activeItem, secondCandidate, direction);

  return (
    compareNumber(firstMetrics.wrapAnchor, secondMetrics.wrapAnchor) ||
    compareNumber(firstMetrics.edgeAnchor, secondMetrics.edgeAnchor) ||
    compareNumber(firstMetrics.crossAxisDistance, secondMetrics.crossAxisDistance) ||
    compareNumber(firstMetrics.primaryDistance, secondMetrics.primaryDistance) ||
    compareNumber(firstMetrics.euclideanDistance, secondMetrics.euclideanDistance)
  );
}

function getWrapMetrics<TId extends string>(
  activeItem: ResolvedNavigationItem<TId>,
  candidate: ResolvedNavigationItem<TId>,
  direction: SelectionDirection,
) {
  const crossAxisDistance =
    direction === "right" || direction === "left"
      ? Math.abs(candidate.centerY - activeItem.centerY)
      : Math.abs(candidate.centerX - activeItem.centerX);

  const primaryDistance =
    direction === "right" || direction === "left"
      ? Math.abs(candidate.centerX - activeItem.centerX)
      : Math.abs(candidate.centerY - activeItem.centerY);

  const wrapAnchor =
    direction === "right"
      ? cycleDistance(candidate.centerY, activeItem.centerY)
      : direction === "left"
        ? cycleDistance(activeItem.centerY, candidate.centerY)
        : direction === "down"
          ? cycleDistance(candidate.centerX, activeItem.centerX)
          : cycleDistance(activeItem.centerX, candidate.centerX);

  const edgeAnchor =
    direction === "right"
      ? candidate.rect.left
      : direction === "left"
        ? -candidate.rect.right
        : direction === "down"
          ? candidate.rect.top
          : -candidate.rect.bottom;

  const euclideanDistance = Math.hypot(candidate.centerX - activeItem.centerX, candidate.centerY - activeItem.centerY);

  return {
    wrapAnchor,
    edgeAnchor,
    crossAxisDistance,
    primaryDistance,
    euclideanDistance,
  };
}

function cycleDistance(targetValue: number, originValue: number): number {
  return targetValue >= originValue ? targetValue - originValue : Number.MAX_SAFE_INTEGER + targetValue;
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): boolean {
  return Math.max(firstStart, secondStart) <= Math.min(firstEnd, secondEnd);
}

function compareBoolean(firstValue: boolean, secondValue: boolean): number {
  return Number(firstValue) - Number(secondValue);
}

function compareNumber(firstValue: number, secondValue: number): number {
  return firstValue - secondValue;
}
