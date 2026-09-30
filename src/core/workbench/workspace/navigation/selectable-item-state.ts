export interface SelectableItemState<TId extends string = string> {
  readonly id: TId;
  readonly isSelected: boolean;
}
