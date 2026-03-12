import {CommonModule} from '@angular/common';
import {
    Component,
    ElementRef,
    HostListener,
    Injector,
    OnDestroy,
    OnInit,
    input,
    Type,
    viewChild
} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {DialogConfig} from './dialog-config';
import {DialogRef} from './dialog-ref';
import {DIALOG_DATA} from './dialog.tokens';
import { IconComponent } from "@cogno/core-ui";

type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

@Component({
  selector: 'app-dialog',
  standalone: true,
    imports: [CommonModule, NgComponentOutlet, IconComponent],
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        display: contents;
      }

      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
      }

      .panel.base-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid var(--background-color-20l);
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.3);
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        z-index: 10001;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px;
        border-bottom: 1px solid var(--background-color-20l);
      }

      .header.movable {
        cursor: move;
        user-select: none;
      }

      .content {
        padding: 12px 6px;
        overflow: auto;
      }

      .resize-handle {
        position: absolute;
        z-index: 1;
      }

      .resize-handle.edge-n,
      .resize-handle.edge-s {
        left: 10px;
        right: 10px;
        height: 10px;
      }

      .resize-handle.edge-e,
      .resize-handle.edge-w {
        top: 10px;
        bottom: 10px;
        width: 10px;
      }

      .resize-handle.edge-n {
        top: -5px;
        cursor: ns-resize;
      }

      .resize-handle.edge-s {
        bottom: -5px;
        cursor: ns-resize;
      }

      .resize-handle.edge-e {
        right: -5px;
        cursor: ew-resize;
      }

      .resize-handle.edge-w {
        left: -5px;
        cursor: ew-resize;
      }

      .resize-handle.corner-ne,
      .resize-handle.corner-nw,
      .resize-handle.corner-se,
      .resize-handle.corner-sw {
        width: 14px;
        height: 14px;
      }

      .resize-handle.corner-ne {
        top: -5px;
        right: -5px;
        cursor: nesw-resize;
      }

      .resize-handle.corner-nw {
        top: -5px;
        left: -5px;
        cursor: nwse-resize;
      }

      .resize-handle.corner-se {
        right: -5px;
        bottom: -5px;
        cursor: nwse-resize;
      }

      .resize-handle.corner-sw {
        left: -5px;
        bottom: -5px;
        cursor: nesw-resize;
      }
    `
  ],
  template: `
    @if (config().hasBackdrop) {
      <div class="backdrop" [ngClass]="config().backdropClass" (click)="onBackdropClick()"></div>
    }
    <div
      #panelElement
      class="panel base-overlay"
      [ngStyle]="panelStyle()"
      [ngClass]="config().panelClass">
        <div class="header" [class.movable]="config().movable" (mousedown)="startMove($event)">
          <div class="title">{{ config().title }}</div>
            @if (config().showCloseButton) {
          <button class="button icon-button" (click)="close()"><app-icon name="mdiClose"></app-icon></button>
            }
        </div>
     
      <div class="content" tabindex="0" #contentEl>
          <ng-container *ngComponentOutlet="component(); injector: contentInjector"></ng-container>
      </div>
      @if (config().resizable) {
        <div class="resize-handle edge-n" (mousedown)="startResize($event, 'n')"></div>
        <div class="resize-handle edge-s" (mousedown)="startResize($event, 's')"></div>
        <div class="resize-handle edge-e" (mousedown)="startResize($event, 'e')"></div>
        <div class="resize-handle edge-w" (mousedown)="startResize($event, 'w')"></div>
        <div class="resize-handle corner-ne" (mousedown)="startResize($event, 'ne')"></div>
        <div class="resize-handle corner-nw" (mousedown)="startResize($event, 'nw')"></div>
        <div class="resize-handle corner-se" (mousedown)="startResize($event, 'se')"></div>
        <div class="resize-handle corner-sw" (mousedown)="startResize($event, 'sw')"></div>
      }
    </div>
  `
})
export class DialogComponent<TData = unknown> implements OnInit, OnDestroy {
  config = input.required<DialogConfig<TData>>();
  dialogRef = input.required<DialogRef<any>>();

  component = input.required<Type<any>>();
  panelElementRef = viewChild<ElementRef<HTMLElement>>('panelElement');

  contentInjector?: Injector;
  private isMoveActive = false;
  private isResizeActive = false;
  private moveMouseOffsetX = 0;
  private moveMouseOffsetY = 0;
  private resizeStartMouseX = 0;
  private resizeStartMouseY = 0;
  private resizeStartWidthPixels = 0;
  private resizeStartHeightPixels = 0;
  private resizeStartLeftPixels = 0;
  private resizeStartTopPixels = 0;
  private resizeDirection: ResizeDirection | null = null;
  private positionTopOverride: string | null = null;
  private positionLeftOverride: string | null = null;
  private widthOverride: string | null = null;
  private heightOverride: string | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    // Create child injector to provide dialog data and ref
    this.contentInjector = Injector.create({
      providers: [
        { provide: DIALOG_DATA, useValue: this.config().data },
        { provide: DialogRef, useValue: this.dialogRef() }
      ],
      parent: this.injector
    });
  }

  ngOnDestroy(): void {
    this.isMoveActive = false;
    this.isResizeActive = false;
    this.resizeDirection = null;
  }

  onBackdropClick() {
    this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(e: Event) {
    e.stopPropagation();
    this.close();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isMoveActive) {
      this.updatePanelPositionFromMouse(event);
      return;
    }

    if (this.isResizeActive) {
      this.updatePanelSizeFromMouse(event);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.isMoveActive = false;
    this.isResizeActive = false;
    this.resizeDirection = null;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const panelElement = this.getPanelElement();
    if (panelElement === null) return;
    this.keepPanelWithinViewport(panelElement);
  }

  startMove(mouseEvent: MouseEvent): void {
    if (!this.config().movable) return;
    if (mouseEvent.button !== 0) return;

    const targetElement = mouseEvent.target as HTMLElement | null;
    if (targetElement?.closest('button') !== null) return;

    const panelElement = this.getPanelElement();
    if (panelElement === null) return;

    const panelRect = panelElement.getBoundingClientRect();
    this.positionTopOverride = `${panelRect.top}px`;
    this.positionLeftOverride = `${panelRect.left}px`;
    this.widthOverride = `${panelRect.width}px`;
    this.heightOverride = `${panelRect.height}px`;
    this.moveMouseOffsetX = mouseEvent.clientX - panelRect.left;
    this.moveMouseOffsetY = mouseEvent.clientY - panelRect.top;
    this.isMoveActive = true;
    mouseEvent.preventDefault();
  }

  startResize(mouseEvent: MouseEvent, direction: ResizeDirection): void {
    if (!this.config().resizable) return;
    if (mouseEvent.button !== 0) return;

    const panelElement = this.getPanelElement();
    if (panelElement === null) return;

    const panelRect = panelElement.getBoundingClientRect();
    this.positionTopOverride = `${panelRect.top}px`;
    this.positionLeftOverride = `${panelRect.left}px`;
    this.resizeStartMouseX = mouseEvent.clientX;
    this.resizeStartMouseY = mouseEvent.clientY;
    this.resizeStartWidthPixels = panelRect.width;
    this.resizeStartHeightPixels = panelRect.height;
    this.resizeStartLeftPixels = panelRect.left;
    this.resizeStartTopPixels = panelRect.top;
    this.resizeDirection = direction;
    this.isResizeActive = true;
    mouseEvent.preventDefault();
  }

  close() {
    this.dialogRef().close();
  }

  panelStyle() {
    const config = this.config();
    const position = config.position;
    const hasPosition =
      !!position &&
      (position.top !== undefined ||
        position.right !== undefined ||
        position.bottom !== undefined ||
        position.left !== undefined);
    const hasPositionOverride = this.positionTopOverride !== null || this.positionLeftOverride !== null;

    return {
      width: this.widthOverride ?? config.width ?? 'auto',
      height: this.heightOverride ?? config.height ?? 'auto',
      maxWidth: config.maxWidth ?? '90vw',
      maxHeight: config.maxHeight ?? '90vh',
      top: this.positionTopOverride ?? (hasPosition ? position?.top : '50%'),
      left: this.positionLeftOverride ?? (hasPosition ? position?.left : '50%'),
      right: hasPosition && !hasPositionOverride ? position?.right : undefined,
      bottom: hasPosition && !hasPositionOverride ? position?.bottom : undefined,
      transform: hasPosition || hasPositionOverride ? 'none' : 'translate(-50%, -50%)',
    };
  }

  private updatePanelPositionFromMouse(mouseEvent: MouseEvent): void {
    const panelElement = this.getPanelElement();
    if (panelElement === null) return;

    const panelRect = panelElement.getBoundingClientRect();
    const maximumLeftPixels = Math.max(0, window.innerWidth - panelRect.width);
    const maximumTopPixels = Math.max(0, window.innerHeight - panelRect.height);
    const leftPixels = this.clampNumber(mouseEvent.clientX - this.moveMouseOffsetX, 0, maximumLeftPixels);
    const topPixels = this.clampNumber(mouseEvent.clientY - this.moveMouseOffsetY, 0, maximumTopPixels);

    this.positionLeftOverride = `${leftPixels}px`;
    this.positionTopOverride = `${topPixels}px`;
  }

  private updatePanelSizeFromMouse(mouseEvent: MouseEvent): void {
    const panelElement = this.getPanelElement();
    if (panelElement === null || this.resizeDirection === null) return;

    const minimumWidthPixels = Math.min(320, window.innerWidth);
    const minimumHeightPixels = Math.min(220, window.innerHeight);
    const deltaX = mouseEvent.clientX - this.resizeStartMouseX;
    const deltaY = mouseEvent.clientY - this.resizeStartMouseY;

    let nextLeftPixels = this.resizeStartLeftPixels;
    let nextTopPixels = this.resizeStartTopPixels;
    let nextWidthPixels = this.resizeStartWidthPixels;
    let nextHeightPixels = this.resizeStartHeightPixels;

    if (this.resizeDirection.includes('e')) {
      nextWidthPixels = this.resizeStartWidthPixels + deltaX;
    }
    if (this.resizeDirection.includes('s')) {
      nextHeightPixels = this.resizeStartHeightPixels + deltaY;
    }
    if (this.resizeDirection.includes('w')) {
      nextWidthPixels = this.resizeStartWidthPixels - deltaX;
      nextLeftPixels = this.resizeStartLeftPixels + deltaX;
    }
    if (this.resizeDirection.includes('n')) {
      nextHeightPixels = this.resizeStartHeightPixels - deltaY;
      nextTopPixels = this.resizeStartTopPixels + deltaY;
    }

    if (nextWidthPixels < minimumWidthPixels) {
      if (this.resizeDirection.includes('w')) {
        nextLeftPixels -= minimumWidthPixels - nextWidthPixels;
      }
      nextWidthPixels = minimumWidthPixels;
    }
    if (nextHeightPixels < minimumHeightPixels) {
      if (this.resizeDirection.includes('n')) {
        nextTopPixels -= minimumHeightPixels - nextHeightPixels;
      }
      nextHeightPixels = minimumHeightPixels;
    }

    nextLeftPixels = this.clampNumber(nextLeftPixels, 0, Math.max(0, window.innerWidth - nextWidthPixels));
    nextTopPixels = this.clampNumber(nextTopPixels, 0, Math.max(0, window.innerHeight - nextHeightPixels));
    nextWidthPixels = this.clampNumber(nextWidthPixels, minimumWidthPixels, window.innerWidth - nextLeftPixels);
    nextHeightPixels = this.clampNumber(nextHeightPixels, minimumHeightPixels, window.innerHeight - nextTopPixels);

    this.positionLeftOverride = `${nextLeftPixels}px`;
    this.positionTopOverride = `${nextTopPixels}px`;
    this.widthOverride = `${nextWidthPixels}px`;
    this.heightOverride = `${nextHeightPixels}px`;
  }

  private getPanelElement(): HTMLElement | null {
    return this.panelElementRef()?.nativeElement ?? null;
  }

  private keepPanelWithinViewport(panelElement: HTMLElement): void {
    const panelRect = panelElement.getBoundingClientRect();
    const maximumLeftPixels = Math.max(0, window.innerWidth - panelRect.width);
    const maximumTopPixels = Math.max(0, window.innerHeight - panelRect.height);
    const leftPixels = this.clampNumber(panelRect.left, 0, maximumLeftPixels);
    const topPixels = this.clampNumber(panelRect.top, 0, maximumTopPixels);
    this.positionLeftOverride = `${leftPixels}px`;
    this.positionTopOverride = `${topPixels}px`;
  }

  private parsePixelValue(pixelValue: string | null): number | undefined {
    if (pixelValue === null) return undefined;
    const parsedValue = Number.parseFloat(pixelValue);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  private clampNumber(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
