import { beforeEach, describe, expect, it, vi } from "vitest";
import { DragPreviewService } from "./drag-preview.service";
import { trackPointerDrag } from "./pointer-drag";

const pressedRectangle = { width: 80, height: 20 } as DOMRect;

function press(currentTarget: EventTarget | null = pressedElement()): MouseEvent {
  return { button: 0, clientX: 100, clientY: 100, currentTarget } as unknown as MouseEvent;
}

function pressedElement(): HTMLElement {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(pressedRectangle);
  return element;
}

function windowMouse(type: "mousemove" | "mouseup", clientX: number, clientY: number, button = 0) {
  window.dispatchEvent(new MouseEvent(type, { clientX, clientY, button, bubbles: true }));
}

describe("trackPointerDrag", () => {
  let dragPreview: {
    startDragPreview: ReturnType<typeof vi.fn>;
    updateDragPreviewPosition: ReturnType<typeof vi.fn>;
    stopDragPreview: ReturnType<typeof vi.fn>;
  };
  const preview = () => dragPreview as unknown as DragPreviewService;

  beforeEach(() => {
    dragPreview = {
      startDragPreview: vi.fn(),
      updateDragPreviewPosition: vi.fn(),
      stopDragPreview: vi.fn(),
    };
  });

  it("reports a release without movement as a click", () => {
    const onRelease = vi.fn();
    const onDragStart = vi.fn();

    trackPointerDrag(press(), preview(), { onDragStart, onRelease });
    windowMouse("mousemove", 103, 103);
    windowMouse("mouseup", 103, 103);

    expect(onDragStart).not.toHaveBeenCalled();
    expect(onRelease).toHaveBeenCalledExactlyOnceWith(expect.any(MouseEvent), false);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("starts the drag past the threshold, previews the pressed element and reports a drop", () => {
    const onRelease = vi.fn();
    const onDragStart = vi.fn();

    trackPointerDrag(press(), preview(), { onDragStart, onRelease });
    windowMouse("mousemove", 100, 104);
    windowMouse("mousemove", 120, 130);
    windowMouse("mouseup", 120, 130);

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(dragPreview.startDragPreview).toHaveBeenCalledExactlyOnceWith(
      pressedRectangle,
      100,
      104,
    );
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenLastCalledWith(120, 130);
    expect(onRelease).toHaveBeenCalledExactlyOnceWith(expect.any(MouseEvent), true);
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("drags without a preview when the press has no element", () => {
    const onDragStart = vi.fn();

    trackPointerDrag(press(null), preview(), { onDragStart, onRelease: vi.fn() });
    windowMouse("mousemove", 110, 100);

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores pointer moves while isActive answers false", () => {
    let active = false;
    const onDragStart = vi.fn();

    trackPointerDrag(press(), preview(), {
      isActive: () => active,
      onDragStart,
      onRelease: vi.fn(),
    });
    windowMouse("mousemove", 150, 150);
    expect(onDragStart).not.toHaveBeenCalled();

    active = true;
    windowMouse("mousemove", 150, 150);
    expect(onDragStart).toHaveBeenCalledTimes(1);

    active = false;
    dragPreview.updateDragPreviewPosition.mockClear();
    windowMouse("mousemove", 160, 160);
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });

  it("cancels instead of releasing when another button goes up", () => {
    const onRelease = vi.fn();
    const onCancel = vi.fn();

    trackPointerDrag(press(), preview(), { onRelease, onCancel });
    windowMouse("mouseup", 100, 100, 2);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("is over after the release: later pointer events reach nobody", () => {
    const onRelease = vi.fn();

    trackPointerDrag(press(), preview(), { onRelease });
    windowMouse("mouseup", 100, 100);
    windowMouse("mousemove", 200, 200);
    windowMouse("mouseup", 200, 200);

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ends early through the returned function", () => {
    const onRelease = vi.fn();

    const stop = trackPointerDrag(press(), preview(), { onRelease });
    stop();
    windowMouse("mousemove", 200, 200);
    windowMouse("mouseup", 200, 200);

    expect(dragPreview.stopDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("still cleans up when the release handler throws", () => {
    const failure = new Error("drop failed");
    const thrown: unknown[] = [];
    // Listener errors do not propagate to dispatchEvent; they surface as an error event.
    const onError = (event: ErrorEvent) => {
      thrown.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);

    trackPointerDrag(press(), preview(), {
      onRelease: () => {
        throw failure;
      },
    });
    try {
      windowMouse("mouseup", 100, 100);
    } catch (error) {
      thrown.push(error);
    }
    window.removeEventListener("error", onError);
    windowMouse("mousemove", 200, 200);

    expect(thrown).toContain(failure);
    expect(dragPreview.stopDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });
});
