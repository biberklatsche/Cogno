/**
 * A width dragged with the pointer on a handle: the handle captures the
 * pointer and carries the `active` class while the drag is on. The panels and
 * columns clamp the width themselves; `T` names what is being resized.
 */
export class PointerResize<T> {
  private drag: {
    target: T;
    startX: number;
    startWidth: number;
    /** 1 when dragging right widens, -1 when dragging left does. */
    direction: 1 | -1;
    handle: HTMLElement;
  } | null = null;

  start(event: PointerEvent, target: T, startWidth: number, direction: 1 | -1 = 1): void {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("active");
    this.drag = { target, startX: event.clientX, startWidth, direction, handle };
  }

  /** The width the pointer has dragged `target` to, or null outside a drag. */
  move(event: PointerEvent): { target: T; width: number } | null {
    const drag = this.drag;
    if (!drag) return null;
    return {
      target: drag.target,
      width: drag.startWidth + (event.clientX - drag.startX) * drag.direction,
    };
  }

  end(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    drag.handle.releasePointerCapture(event.pointerId);
    drag.handle.classList.remove("active");
    this.drag = null;
  }
}
