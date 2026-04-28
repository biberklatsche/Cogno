import { Component, DestroyRef, ElementRef, OnDestroy, Signal, viewChildren } from "@angular/core";
import { ActionKeybindingPort, defaultWorkspaceIdContract } from "@cogno/core-api";
import {
  CopyEditDeleteComponent,
  DragPreviewService,
  IconComponent,
  TooltipDirective,
} from "@cogno/core-ui";
import { DirectionalNavigationItem } from "../navigation/directional-navigation.engine";
import { WorkspaceEntryViewModel, WorkspaceService } from "./workspace.service";

@Component({
  selector: "app-workspace-side",
  standalone: true,
  imports: [CopyEditDeleteComponent, IconComponent, TooltipDirective],
  template: `
    <section class="workspace-side">
      <ul class="workspace-grid">
        @for (workspaceEntry of workspaceEntries(); track workspaceEntry.id) {
          <li
            #workspaceTileElement
            class="workspace-tile center"
            [attr.data-navigation-id]="workspaceEntry.id"
            [class.selected]="workspaceEntry.isSelected"
            [class.active]="workspaceEntry.isActive"
            [class.open]="workspaceEntry.isOpen"
            [class.is-fixed]="workspaceEntry.id === defaultWorkspaceId"
            [class.is-dragging]="isDraggingWorkspace && draggedWorkspaceIdentifier === workspaceEntry.id"
            [style.background-color]="workspaceEntry.isActive && workspaceEntry.color ? 'var(--color-' + workspaceEntry.color + '-ct2)' : undefined"
            [style.border-color]="workspaceEntry.isOpen && workspaceEntry.color ? 'var(--color-' + workspaceEntry.color + ')' : undefined"
            [appTooltip]="workspaceEntry.name"
            [appTooltipSecondary]="getWorkspaceShortcutLabel($index)"
            (click)="onWorkspaceClick(workspaceEntry.id, $event)"
            (mousedown)="startWorkspaceReorderInteraction($event, workspaceEntry.id)"
            (mouseenter)="reorderWhileDragging(workspaceEntry.id, $event)"
          >
            <div class="workspace-tile__content">
              <div
                class="workspace-badge"
                [style.color]="workspaceEntry.id === defaultWorkspaceId ? 'var(--foreground-color)' : 'var(--background-color)'"
                [style.background-color]="workspaceEntry.color ? 'var(--color-' + workspaceEntry.color + ')' : 'var(--color-green)'"
              >
                {{ (workspaceEntry.name || "")[0] || "?" }}
                @if (workspaceEntry.isDirty) {
                  <span class="workspace-dirty-indicator" aria-hidden="true">
                    <app-icon name="mdiTableEdit"></app-icon>
                  </span>
                }
              </div>
              <div class="workspace-text">
                <div class="workspace-name">{{ workspaceEntry.name }}</div>
              </div>

              @if (workspaceEntry.id !== defaultWorkspaceId) {
                @if (workspaceEntry.isOpen) {
                  <button
                    class="button icon-button workspace-close-button"
                    [class.visible]="workspaceEntry.isOpen || workspaceEntry.isActive"
                    type="button"
                    (click)="closeWorkspace(workspaceEntry.id, $event)"
                  >
                    <app-icon name="mdiClose"></app-icon>
                  </button>
                }
                <div class="space"></div>
                <div class="workspace-actions">
                  @if (workspaceEntry.isDirty) {
                    <button
                      class="button icon-button workspace-save-button visible"
                      type="button"
                      title="Save workspace"
                      (click)="saveWorkspace(workspaceEntry.id, $event)"
                    >
                      <app-icon name="mdiContentSaveOutline"></app-icon>
                    </button>
                  }
                  <app-copy-edit-delete
                    [enableEdit]="true"
                    [enableDelete]="true"
                    [enableCopy]="false"
                    (onEvent)="onWorkspaceAction(workspaceEntry.id, $event)"
                  ></app-copy-edit-delete>
                </div>
              }
            </div>
          </li>
        }
        <li class="center">
          <button class="button icon-button workspace-add-button" type="button" (click)="openCreateWorkspaceDialog()">
            <app-icon name="mdiPlus"></app-icon>
          </button>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      :host,
      .workspace-side {
        display: block;
      }

      :host {
        container-type: inline-size;
      }

      .workspace-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        list-style: none;
        margin: 0;
        padding: 0;
        width: 100%;
      }

      @container (max-width: 360px) {
        .workspace-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .workspace-tile {
        position: relative;
        border-radius: var(--button-border-radius);
        border: 1px solid var(--background-color-20l-ct);
        background-color: var(--background-color-20l-ct);
        opacity: 0.7;
        cursor: default;
        height: 3.5rem;
        transition:
          opacity 120ms ease-out,
          transform 120ms ease-out,
          border-color 120ms ease-out,
          background-color 120ms ease-out;
      }

      .workspace-tile:hover .workspace-actions {
        opacity: 1;
      }

      .workspace-tile:hover .workspace-close-button {
        opacity: 1;
      }

      .workspace-tile.selected {
        background: var(--background-color-20l);
        border: 1px solid var(--background-color-30l);
        outline: none;
        opacity: 1;
      }

      .workspace-tile.active {
        opacity: 1;
      }

      .workspace-tile.open:not(.selected) {
        opacity: 1;
      }

      .workspace-tile:active {
        cursor: pointer;
      }

      .workspace-tile.is-fixed {
        cursor: default;
      }

      .workspace-tile.is-fixed:active {
        cursor: default;
      }

      .workspace-tile.is-dragging {
        border-style: dashed;
      }

      .center {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
      }

      .workspace-tile__content {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.8rem;
        box-sizing: border-box;
        width: 100%;
      }

      .workspace-badge {
        position: relative;
        width: 24px;
        min-width: 24px;
        height: 24px;
        font-size: 16px;
        border-radius: 0.3rem;
        margin-right: 0.5rem;
        display: grid;
        place-items: center;
        line-height: 26px;
        text-transform: capitalize;
      }

      .workspace-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        overflow: hidden;
        min-width: 0;
      }

      .workspace-dirty-indicator {
        position: absolute;
        right: -0.28rem;
        bottom: -0.28rem;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 0.8rem;
        height: 0.8rem;
        padding: 1px;
        border-radius: 999px;
        background: var(--background-color-20l-ct);
        color: var(--foreground-color);
        box-shadow: 0 0 0 1px var(--background-color-20l-ct);
        opacity: 0.95;
      }

      .workspace-name {
        font-size: 1rem;
        color: var(--color-text, inherit);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
      }

      .space {
        flex: 1;
      }

      .workspace-add-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .workspace-actions {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        flex: 0 0 auto;
        opacity: 0;
        transition: opacity 120ms ease-out;
        transform: translateX(-25px);
      }

      .workspace-save-button {
        opacity: 0;
        transition: opacity 120ms ease-out;
      }

      .workspace-save-button.visible {
        opacity: 1;
      }

      .workspace-close-button {
        position: absolute;
        top: 2px;
        right: 2px;
        opacity: 0;
        transition: opacity 120ms ease-out;
      }

      .workspace-close-button.visible {
        opacity: 1;
      }
    `,
  ],
})
export class WorkspaceSideComponent implements OnDestroy {
  private static readonly minimumDragStartDistanceInPixels = 4;

  readonly workspaceEntries: Signal<WorkspaceEntryViewModel[]>;
  readonly defaultWorkspaceId = defaultWorkspaceIdContract;
  isDraggingWorkspace = false;
  draggedWorkspaceIdentifier: string | undefined;

  private mouseDownWorkspaceIdentifier: string | undefined;
  private mouseDownClientX = 0;
  private mouseDownClientY = 0;
  private mouseDownWorkspaceRectangle: DOMRect | undefined;
  private suppressNextWorkspaceClick = false;
  private suppressNextWorkspaceClickTimeoutId: number | undefined;
  private readonly handleWindowMouseMove = (event: MouseEvent): void =>
    this.onWindowMouseMove(event);
  private readonly handleWindowMouseUp = (event: MouseEvent): void => this.onWindowMouseUp(event);
  private readonly workspaceTileElements =
    viewChildren<ElementRef<HTMLElement>>("workspaceTileElement");
  private readonly navigationItemsProvider = () => this.collectNavigationItems();

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly dragPreviewService: DragPreviewService,
    private readonly actionKeybinding: ActionKeybindingPort,
    destroyRef: DestroyRef,
  ) {
    this.workspaceEntries = this.workspaceService.workspaceEntries;
    this.workspaceService.registerNavigationItemsProvider(this.navigationItemsProvider);
    destroyRef.onDestroy(() => {
      this.workspaceService.unregisterNavigationItemsProvider(this.navigationItemsProvider);
    });
  }

  ngOnDestroy(): void {
    this.removeWindowPointerListeners();
    this.clearSuppressedWorkspaceClick();
    this.dragPreviewService.stopDragPreview();
  }

  async restoreWorkspace(workspaceId: string): Promise<void> {
    await this.workspaceService.restoreWorkspace(workspaceId);
  }

  onWorkspaceClick(workspaceId: string, event: MouseEvent): void {
    if (this.suppressNextWorkspaceClick) {
      this.suppressNextWorkspaceClick = false;
      if (this.suppressNextWorkspaceClickTimeoutId !== undefined) {
        window.clearTimeout(this.suppressNextWorkspaceClickTimeoutId);
        this.suppressNextWorkspaceClickTimeoutId = undefined;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    void this.restoreWorkspace(workspaceId);
  }

  async closeWorkspace(workspaceId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    await this.workspaceService.closeWorkspace(workspaceId);
  }

  async saveWorkspace(workspaceId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    await this.workspaceService.saveWorkspace(workspaceId);
  }

  startWorkspaceReorderInteraction(event: MouseEvent, workspaceId: string): void {
    if (event.button !== 0 || workspaceId === this.defaultWorkspaceId) {
      return;
    }
    if (this.isInsideNonDraggableWorkspaceControl(event.target)) {
      return;
    }

    event.preventDefault();
    this.clearSuppressedWorkspaceClick();
    this.isDraggingWorkspace = false;
    this.draggedWorkspaceIdentifier = undefined;
    this.mouseDownWorkspaceIdentifier = workspaceId;
    this.mouseDownClientX = event.clientX;
    this.mouseDownClientY = event.clientY;
    const currentTargetElement = event.currentTarget;
    this.mouseDownWorkspaceRectangle =
      currentTargetElement instanceof HTMLElement
        ? currentTargetElement.getBoundingClientRect()
        : undefined;
    this.addWindowPointerListeners();
  }

  openCreateWorkspaceDialog(): void {
    this.workspaceService.openCreateWorkspaceDialog();
  }

  async onWorkspaceAction(workspaceId: string, action: "copy" | "edit" | "delete"): Promise<void> {
    if (action === "edit") {
      this.workspaceService.openEditWorkspaceDialog(workspaceId);
      return;
    }
    if (action === "delete") {
      await this.workspaceService.deleteWorkspace(workspaceId);
    }
  }

  getWorkspaceShortcutLabel(index: number): string {
    return this.actionKeybinding.getKeybindingLabel(this.getWorkspaceShortcutActionName(index));
  }

  private getWorkspaceShortcutActionName(index: number): string {
    if (index === 0) {
      return "select_workspace_default";
    }

    return `select_workspace_${index}`;
  }

  private collectNavigationItems(): ReadonlyArray<DirectionalNavigationItem<string>> {
    return this.workspaceTileElements()
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

  reorderWhileDragging(targetWorkspaceIdentifier: string, event: MouseEvent): void {
    if (!this.isDraggingWorkspace || event.buttons === 0 || !this.draggedWorkspaceIdentifier) {
      return;
    }
    if (
      this.draggedWorkspaceIdentifier === targetWorkspaceIdentifier ||
      targetWorkspaceIdentifier === this.defaultWorkspaceId
    ) {
      return;
    }

    void this.workspaceService.reorderWorkspaces(
      this.draggedWorkspaceIdentifier,
      targetWorkspaceIdentifier,
    );
  }

  private onWindowMouseMove(event: MouseEvent): void {
    if (this.isDraggingWorkspace) {
      this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
      return;
    }
    if (!this.mouseDownWorkspaceIdentifier) {
      return;
    }

    const horizontalDistanceInPixels = Math.abs(event.clientX - this.mouseDownClientX);
    const verticalDistanceInPixels = Math.abs(event.clientY - this.mouseDownClientY);
    if (
      horizontalDistanceInPixels < WorkspaceSideComponent.minimumDragStartDistanceInPixels &&
      verticalDistanceInPixels < WorkspaceSideComponent.minimumDragStartDistanceInPixels
    ) {
      return;
    }

    this.isDraggingWorkspace = true;
    this.draggedWorkspaceIdentifier = this.mouseDownWorkspaceIdentifier;
    if (this.mouseDownWorkspaceRectangle) {
      this.dragPreviewService.startDragPreview(
        this.mouseDownWorkspaceRectangle,
        event.clientX,
        event.clientY,
      );
    }
    this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
  }

  private onWindowMouseUp(event: MouseEvent): void {
    if (event.button !== 0) {
      this.mouseDownWorkspaceIdentifier = undefined;
      this.mouseDownWorkspaceRectangle = undefined;
      this.removeWindowPointerListeners();
      this.dragPreviewService.stopDragPreview();
      return;
    }

    if (this.isDraggingWorkspace) {
      this.isDraggingWorkspace = false;
      this.draggedWorkspaceIdentifier = undefined;
      this.suppressWorkspaceClickOnce();
      void this.workspaceService.persistWorkspaceOrder();
    }

    this.mouseDownWorkspaceIdentifier = undefined;
    this.mouseDownWorkspaceRectangle = undefined;
    this.removeWindowPointerListeners();
    this.dragPreviewService.stopDragPreview();
  }

  private addWindowPointerListeners(): void {
    window.addEventListener("mousemove", this.handleWindowMouseMove, true);
    window.addEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private removeWindowPointerListeners(): void {
    window.removeEventListener("mousemove", this.handleWindowMouseMove, true);
    window.removeEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private suppressWorkspaceClickOnce(): void {
    this.suppressNextWorkspaceClick = true;
    if (this.suppressNextWorkspaceClickTimeoutId !== undefined) {
      window.clearTimeout(this.suppressNextWorkspaceClickTimeoutId);
    }
    this.suppressNextWorkspaceClickTimeoutId = window.setTimeout(() => {
      this.clearSuppressedWorkspaceClick();
    }, 0);
  }

  private clearSuppressedWorkspaceClick(): void {
    this.suppressNextWorkspaceClick = false;
    if (this.suppressNextWorkspaceClickTimeoutId !== undefined) {
      window.clearTimeout(this.suppressNextWorkspaceClickTimeoutId);
      this.suppressNextWorkspaceClickTimeoutId = undefined;
    }
  }

  private isInsideNonDraggableWorkspaceControl(eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof HTMLElement)) {
      return false;
    }
    return !!eventTarget.closest(
      ".workspace-close-button, app-copy-edit-delete, .workspace-actions, button",
    );
  }
}
