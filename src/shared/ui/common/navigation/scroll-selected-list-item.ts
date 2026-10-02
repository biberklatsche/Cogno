export function scrollSelectedListItemIntoView(
  listElement: HTMLUListElement | undefined | null,
  selectedIndex: number,
): void {
  if (!listElement || selectedIndex < 0) {
    return;
  }

  const selectedElement = listElement.children.item(selectedIndex) as HTMLElement | null;
  selectedElement?.scrollIntoView({ block: "nearest" });
}
