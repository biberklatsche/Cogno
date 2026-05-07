import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Signal,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ContextMenuOverlayService } from "@cogno/app/menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "@cogno/app/menu/context-menu-overlay/context-menu-overlay.types";
import {
  defaultWorkspaceIdContract,
  WorkspaceEntryContract,
  WorkspaceHostPort,
} from "@cogno/core-api";
import { IconComponent, TooltipDirective } from "@cogno/core-ui";

@Component({
  selector: "app-selected-workspace-header",
  standalone: true,
  template: `
    @if (activeWorkspace(); as activeWorkspaceEntry) {
      @if (hasWorkspaceMenu()) {
        <button
          class="selected-workspace-header selected-workspace-header--interactive"
          type="button"
          [style.color]="activeWorkspaceEntry.color ? 'var(--color-' + activeWorkspaceEntry.color + ')' : 'var(--foreground-color)'"
          [appTooltip]="activeWorkspaceEntry.name"
          aria-haspopup="menu"
          aria-label="Select open workspace"
          (click)="openWorkspaceMenu($event)"
        >
          @if (activeWorkspaceEntry.isDirty) {
            <span class="selected-workspace-header__dirty" aria-hidden="true">
              <app-icon name="mdiTableEdit"></app-icon>
            </span>
          }
          <span class="selected-workspace-header__label">
            {{ activeWorkspaceEntry.name }}
          </span>
          <span class="selected-workspace-header__chevron" aria-hidden="true"></span>
        </button>
      } @else {
        <div
          class="selected-workspace-header"
          [style.color]="activeWorkspaceEntry.color ? 'var(--color-' + activeWorkspaceEntry.color + ')' : 'var(--foreground-color)'"
          [appTooltip]="activeWorkspaceEntry.name"
        >
          @if (activeWorkspaceEntry.isDirty) {
            <span class="selected-workspace-header__dirty" aria-hidden="true">
              <app-icon name="mdiTableEdit"></app-icon>
            </span>
          }
          <span class="selected-workspace-header__label">
            {{ activeWorkspaceEntry.name }}
          </span>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 0 1 auto;
        justify-content: flex-end;
        min-width: 0;
        width: fit-content;
        max-width: 100%;
        margin-left: auto;
        height: 26px;
        min-height: 26px;
      }

      .selected-workspace-header {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        width: fit-content;
        max-width: 100%;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
        min-height: 100%;
        padding: 0.15rem 0.75rem 0;
        box-sizing: border-box;
      }

      .selected-workspace-header--interactive {
        background: transparent;
        border: none;
        border-radius: 0.35rem;
        transition: background-color 120ms ease;
      }

      .selected-workspace-header--interactive:hover,
      .selected-workspace-header--interactive:focus-visible {
        background: var(--background-color-20l);
        outline: none;
      }

      .selected-workspace-header__label {
        display: block;
        max-width: 15ch;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .selected-workspace-header__dirty {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.95rem;
        height: 0.95rem;
        opacity: 0.9;
      }

      .selected-workspace-header__chevron {
        flex: 0 0 auto;
        width: 0.45rem;
        height: 0.45rem;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.1rem) rotate(45deg);
        opacity: 0.8;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TooltipDirective],
})
export class SelectedWorkspaceHeaderComponent {
  private readonly workspaceEntries = signal<ReadonlyArray<WorkspaceEntryContract>>([]);
  protected readonly activeWorkspace: Signal<WorkspaceEntryContract | undefined>;
  protected readonly openWorkspaceEntries: Signal<WorkspaceEntryContract[]>;
  protected readonly hasWorkspaceMenu: Signal<boolean>;

  constructor(
    private readonly workspaceHostPort: WorkspaceHostPort,
    private readonly contextMenuOverlayService: ContextMenuOverlayService,
    destroyRef: DestroyRef,
  ) {
    this.workspaceHostPort.workspaceEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((workspaceEntries) => {
        this.workspaceEntries.set(workspaceEntries);
      });

    this.activeWorkspace = computed(() => {
      const activeWorkspaceEntry = this.workspaceEntries().find(
        (workspaceEntry) => workspaceEntry.isActive,
      );

      if (activeWorkspaceEntry?.id !== defaultWorkspaceIdContract) {
        return activeWorkspaceEntry;
      }

      return this.openWorkspaceEntries().length > 1 ? activeWorkspaceEntry : undefined;
    });
    this.openWorkspaceEntries = computed(() =>
      this.workspaceEntries().filter(
        (workspaceEntry) => workspaceEntry.isOpen || workspaceEntry.isActive,
      ),
    );
    this.hasWorkspaceMenu = computed(() => this.openWorkspaceEntries().length > 1);
  }

  protected openWorkspaceMenu(event: Event): void {
    if (!this.hasWorkspaceMenu()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.contextMenuOverlayService.openContextForElement(event.currentTarget as HTMLElement, {
      items: this.buildWorkspaceMenuItems(),
    });
  }

  private buildWorkspaceMenuItems(): ContextMenuItem[] {
    return this.openWorkspaceEntries().map((workspaceEntry) => ({
      label: workspaceEntry.name,
      disabled: workspaceEntry.isActive,
      action: () => {
        void this.workspaceHostPort.restoreWorkspace(workspaceEntry.id);
      },
    }));
  }
}
