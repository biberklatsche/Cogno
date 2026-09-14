import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Signal,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { relativeSavedTime } from "@cogno/core/workbench/workspace/auto-save-status";
import { WorkspaceHostService } from "@cogno/core/workbench/workspace/workspace-host.service";
import { defaultWorkspaceIdContract, WorkspaceEntryContract } from "@cogno/shared/domain";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  IconComponent,
  TooltipDirective,
} from "@cogno/shared/ui";

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
          [appTooltip]="workspaceStatusTooltip(activeWorkspaceEntry)"
          appTooltipSecondary="Open workspaces"
          aria-haspopup="menu"
          aria-label="Select open workspace"
          (click)="openWorkspaceMenu($event)"
        >
          @if (restoreEnabled()) {
            @if (activeWorkspaceEntry.autoSaveStatus === "saving") {
              <span class="selected-workspace-header__status" aria-hidden="true">
                <app-icon class="spin" name="mdiLoading"></app-icon>
              </span>
            } @else if (activeWorkspaceEntry.autoSaveStatus === "saved") {
              <span class="selected-workspace-header__status" aria-hidden="true">
                <app-icon name="mdiCheck"></app-icon>
              </span>
            }
          } @else if (activeWorkspaceEntry.isDirty) {
            <span class="selected-workspace-header__dirty" aria-hidden="true">
              <app-icon name="mdiViewDashboardEdit"></app-icon>
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
          [appTooltip]="workspaceStatusTooltip(activeWorkspaceEntry)"
        >
          @if (restoreEnabled()) {
            @if (activeWorkspaceEntry.autoSaveStatus === "saving") {
              <span class="selected-workspace-header__status" aria-hidden="true">
                <app-icon class="spin" name="mdiLoading"></app-icon>
              </span>
            } @else if (activeWorkspaceEntry.autoSaveStatus === "saved") {
              <span class="selected-workspace-header__status" aria-hidden="true">
                <app-icon name="mdiCheck"></app-icon>
              </span>
            }
          } @else if (activeWorkspaceEntry.isDirty) {
            <span class="selected-workspace-header__dirty" aria-hidden="true">
              <app-icon name="mdiViewDashboardEdit"></app-icon>
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
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
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

      .selected-workspace-header__status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.85rem;
        height: 0.85rem;
        opacity: 0.55;
      }

      .selected-workspace-header__status .spin {
        animation: selected-workspace-header-spin 0.9s linear infinite;
      }

      @keyframes selected-workspace-header-spin {
        to {
          transform: rotate(360deg);
        }
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
  /** When session restore is on, the workspace auto-saves (step 27g). */
  private readonly restoreEnabledSignal = signal(true);
  protected readonly restoreEnabled = this.restoreEnabledSignal.asReadonly();

  constructor(
    private readonly workspaceHostPort: WorkspaceHostService,
    private readonly contextMenuOverlayService: ContextMenuOverlayService,
    configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    configService.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((config) =>
        this.restoreEnabledSignal.set(config.terminal?.restore?.enabled ?? true),
      );
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

    this.contextMenuOverlayService.openAtElement(event.currentTarget as HTMLElement, {
      items: this.buildWorkspaceMenuItems(),
    });
  }

  protected workspaceStatusTooltip(workspaceEntry: WorkspaceEntryContract): string {
    if (this.restoreEnabled()) {
      if (workspaceEntry.autoSaveStatus === "saving") {
        return `${workspaceEntry.name} · speichert…`;
      }
      if (workspaceEntry.autoSaveStatus === "saved" && workspaceEntry.autoSavedAt !== undefined) {
        return `${workspaceEntry.name} · automatisch gespeichert ${relativeSavedTime(workspaceEntry.autoSavedAt)}`;
      }
      return workspaceEntry.name;
    }
    return workspaceEntry.isDirty
      ? `${workspaceEntry.name} has unsaved workspace edits`
      : workspaceEntry.name;
  }

  private buildWorkspaceMenuItems(): ContextMenuItem[] {
    return this.openWorkspaceEntries().map((workspaceEntry) => ({
      label: workspaceEntry.name,
      color: workspaceEntry.color ? `var(--color-${workspaceEntry.color})` : undefined,
      checked: workspaceEntry.isActive,
      action: () => {
        if (workspaceEntry.isActive) return;
        void this.workspaceHostPort.restoreWorkspace(workspaceEntry.id);
      },
    }));
  }
}
