import {CommonModule} from '@angular/common';
import {
    Component,
    ElementRef,
    HostListener,
    Injector,
    OnDestroy,
    OnInit,
    inject,
    input,
    Type,
    viewChild
} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {DialogConfig} from './dialog-config';
import {DialogRef} from './dialog-ref';
import {DIALOG_DATA} from './dialog.tokens';
import {IconComponent} from "../../icons/icon/icon.component";

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
        right: 0;
        bottom: 0;
        width: 12px;
        height: 12px;
        cursor: nwse-resize;
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
        <div class="resize-handle" (mousedown)="startResize($event)"></div>
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

  private readonly injector = inject(Injector);
  private isMoveActive = false;
  private isResizeActive = false;
  private moveMouseOffsetX = 0;
  private moveMouseOffsetY = 0;
  private resizeStartMouseX = 0;
  private resizeStartMouseY = 0;
  private resizeStartWidthPixels = 0;
  private resizeStartHeightPixels = 0;
  private positionTopOverride: string | null = null;
  private positionLeftOverride: string | null = null;
  private widthOverride: string | null = null;
  private heightOverride: string | null = null;

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

  startResize(mouseEvent: MouseEvent): void {
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
    if (panelElement === null) return;

    const panelRect = panelElement.getBoundingClientRect();
    const panelLeftPixels = this.parsePixelValue(this.positionLeftOverride) ?? panelRect.left;
    const panelTopPixels = this.parsePixelValue(this.positionTopOverride) ?? panelRect.top;

    const maximumWidthPixels = Math.max(0, window.innerWidth - panelLeftPixels);
    const maximumHeightPixels = Math.max(0, window.innerHeight - panelTopPixels);
    const minimumWidthPixels = Math.min(320, maximumWidthPixels);
    const minimumHeightPixels = Math.min(220, maximumHeightPixels);
    const widthPixels = this.clampNumber(
      this.resizeStartWidthPixels + mouseEvent.clientX - this.resizeStartMouseX,
      minimumWidthPixels,
      maximumWidthPixels
    );
    const heightPixels = this.clampNumber(
      this.resizeStartHeightPixels + mouseEvent.clientY - this.resizeStartMouseY,
      minimumHeightPixels,
      maximumHeightPixels
    );

    this.widthOverride = `${widthPixels}px`;
    this.heightOverride = `${heightPixels}px`;
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
