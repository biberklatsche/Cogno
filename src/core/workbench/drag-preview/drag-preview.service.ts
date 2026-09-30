import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DragPreviewService {
  private previewElement: HTMLDivElement | undefined;
  private previewHalfWidthInPixels = 0;
  private previewHalfHeightInPixels = 0;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  startDragPreview(sourceRectangle: DOMRect, pointerClientX: number, pointerClientY: number): void {
    this.stopDragPreview();

    const previewElement = this.document.createElement("div");
    previewElement.className = "drag-preview-rectangle";
    previewElement.style.width = `${Math.max(24, Math.round(sourceRectangle.width))}px`;
    previewElement.style.height = `${Math.max(18, Math.round(sourceRectangle.height))}px`;
    this.document.body.appendChild(previewElement);
    this.previewElement = previewElement;
    this.previewHalfWidthInPixels = previewElement.offsetWidth / 2;
    this.previewHalfHeightInPixels = previewElement.offsetHeight / 2;
    this.updateDragPreviewPosition(pointerClientX, pointerClientY);
  }

  updateDragPreviewPosition(pointerClientX: number, pointerClientY: number): void {
    if (!this.previewElement) {
      return;
    }
    const centeredLeftInPixels = pointerClientX - this.previewHalfWidthInPixels;
    const centeredTopInPixels = pointerClientY - this.previewHalfHeightInPixels;
    this.previewElement.style.transform = `translate3d(${centeredLeftInPixels}px, ${centeredTopInPixels}px, 0)`;
  }

  stopDragPreview(): void {
    if (!this.previewElement) {
      return;
    }
    this.previewElement.remove();
    this.previewElement = undefined;
    this.previewHalfWidthInPixels = 0;
    this.previewHalfHeightInPixels = 0;
  }
}
