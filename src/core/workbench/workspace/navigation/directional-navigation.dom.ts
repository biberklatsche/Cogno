import { ElementRef } from "@angular/core";
import { DirectionalNavigationItem } from "./directional-navigation.engine";

export function collectDirectionalNavigationItems(
  elementRefs: ReadonlyArray<ElementRef<HTMLElement>>,
): ReadonlyArray<DirectionalNavigationItem<string>> {
  return elementRefs
    .map((elementRef) => elementRef.nativeElement)
    .map((element) => {
      const navigationId = element.dataset["navigationId"];
      if (!navigationId) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        id: navigationId,
        rect: {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      } satisfies DirectionalNavigationItem<string>;
    })
    .filter((item): item is DirectionalNavigationItem<string> => item !== null);
}
