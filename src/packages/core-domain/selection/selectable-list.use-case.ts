import { SelectableItemState } from "./selectable-item-state";

export type SelectionDirection = "up" | "down" | "left" | "right";

export class SelectableListUseCase {
  static initializeSelection<TItem extends SelectableItemState<string>>(
    items: ReadonlyArray<TItem>,
  ): TItem[] {
    if (items.length === 0) {
      return [...items];
    }
    if (items.some((item) => item.isSelected)) {
      return [...items];
    }
    return items.map((item, index) => ({
      ...item,
      isSelected: index === 0,
    }));
  }

  static syncSelection<TItem extends SelectableItemState<string>>(
    currentItems: ReadonlyArray<SelectableItemState<string>>,
    nextItems: ReadonlyArray<TItem>,
    fallbackSelectedId?: string,
  ): TItem[] {
    const currentlySelectedItemId = currentItems.find((item) => item.isSelected)?.id;
    const selectedItemId = currentlySelectedItemId ?? fallbackSelectedId ?? nextItems.at(0)?.id;

    return nextItems.map((item) => ({
      ...item,
      isSelected: item.id === selectedItemId,
    }));
  }

  static selectNext<TItem extends SelectableItemState<string>>(
    items: ReadonlyArray<TItem>,
    direction: SelectionDirection,
    resolveNavigationTarget?: (
      activeItemId: string,
      direction: SelectionDirection,
    ) => string | undefined,
  ): TItem[] {
    if (items.length === 0) {
      return [...items];
    }

    const currentIndex = items.findIndex((item) => item.isSelected);
    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const activeItemId = items[safeCurrentIndex]?.id;
    const nextItemId = activeItemId
      ? resolveNavigationTarget?.(activeItemId, direction)
      : undefined;
    const nextIndex =
      nextItemId === undefined
        ? SelectableListUseCase.resolveFallbackIndex(items.length, safeCurrentIndex, direction)
        : SelectableListUseCase.resolveNavigationIndex(
            items,
            nextItemId,
            safeCurrentIndex,
            direction,
          );

    return items.map((item, index) => ({
      ...item,
      isSelected: index === nextIndex,
    }));
  }

  static getSelectedId<TItem extends SelectableItemState<string>>(
    items: ReadonlyArray<TItem>,
  ): string | undefined {
    return items.find((item) => item.isSelected)?.id;
  }

  static getSelectedItem<TItem extends SelectableItemState<string>>(
    items: ReadonlyArray<TItem>,
    item?: TItem,
  ): TItem | undefined {
    return item ?? items.find((entry) => entry.isSelected);
  }

  private static resolveNavigationIndex<TItem extends SelectableItemState<string>>(
    items: ReadonlyArray<TItem>,
    nextItemId: string,
    safeCurrentIndex: number,
    direction: SelectionDirection,
  ): number {
    const nextIndex = items.findIndex((item) => item.id === nextItemId);
    if (nextIndex >= 0) {
      return nextIndex;
    }
    return SelectableListUseCase.resolveFallbackIndex(items.length, safeCurrentIndex, direction);
  }

  private static resolveFallbackIndex(
    itemCount: number,
    safeCurrentIndex: number,
    direction: SelectionDirection,
  ): number {
    if (direction === "left" || direction === "up") {
      return (safeCurrentIndex - 1 + itemCount) % itemCount;
    }
    return (safeCurrentIndex + 1) % itemCount;
  }
}
