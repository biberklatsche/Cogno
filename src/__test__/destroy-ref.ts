import type { DestroyRef } from "@angular/core";

export function getDestroyRef(): DestroyRef {
  return {
    onDestroy: () => () => {},
    destroyed: false,
  };
}
