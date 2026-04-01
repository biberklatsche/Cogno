import { DestroyRef } from "@angular/core";

export function getDestroyRef(): DestroyRef {
  return {
    onDestroy: () => () => {},
    destroyed: false,
  };
}



