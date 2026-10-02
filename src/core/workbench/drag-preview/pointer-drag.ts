import { DragPreviewService } from "./drag-preview.service";

/** How far the pointer has to travel from the press before it counts as a drag. */
const DRAG_START_DISTANCE_IN_PIXELS = 4;

export interface PointerDragHandlers {
  /** Asked on every pointer move; while it answers false the move is ignored. */
  isActive?(): boolean;
  /** The pointer crossed the threshold: the press turned into a drag. */
  onDragStart?(): void;
  /** The left button was released. `dragged` tells a drop from a plain click. */
  onRelease(event: MouseEvent, dragged: boolean): void;
  /** Another button was released: the interaction is abandoned. */
  onCancel?(): void;
}

/**
 * Follows the pointer from a press (`mousedown`) until its release: past the
 * threshold it shows the drag preview of the pressed element and moves it along.
 * The preview and the window listeners are gone after the release; the
 * returned function ends the interaction early (a component's `ngOnDestroy`).
 */
export function trackPointerDrag(
  pressEvent: MouseEvent,
  dragPreview: DragPreviewService,
  handlers: PointerDragHandlers,
): () => void {
  const pressedElement = pressEvent.currentTarget;
  const sourceRectangle =
    pressedElement instanceof HTMLElement ? pressedElement.getBoundingClientRect() : undefined;
  const pressClientX = pressEvent.clientX;
  const pressClientY = pressEvent.clientY;
  let dragged = false;

  const onMouseMove = (event: MouseEvent): void => {
    if (handlers.isActive && !handlers.isActive()) return;
    if (!dragged) {
      if (
        Math.abs(event.clientX - pressClientX) < DRAG_START_DISTANCE_IN_PIXELS &&
        Math.abs(event.clientY - pressClientY) < DRAG_START_DISTANCE_IN_PIXELS
      ) {
        return;
      }
      dragged = true;
      handlers.onDragStart?.();
      if (sourceRectangle) {
        dragPreview.startDragPreview(sourceRectangle, event.clientX, event.clientY);
      }
    }
    dragPreview.updateDragPreviewPosition(event.clientX, event.clientY);
  };

  const onMouseUp = (event: MouseEvent): void => {
    try {
      if (event.button === 0) {
        handlers.onRelease(event, dragged);
      } else {
        handlers.onCancel?.();
      }
    } finally {
      stop();
    }
  };

  const stop = (): void => {
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    dragPreview.stopDragPreview();
  };

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  return stop;
}
