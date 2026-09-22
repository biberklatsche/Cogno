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
import { workspaceBadge } from "@cogno/core/workbench/workspace/workspace-badge";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { defaultWorkspaceIdContract, WorkspaceEntryContract } from "@cogno/shared/domain";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  LetterBadge,
  LetterBadgeComponent,
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
          [appTooltip]="workspaceStatusTooltip(activeWorkspaceEntry)"
          appTooltipSecondary="Open workspaces"
          aria-haspopup="menu"
          aria-label="Select open workspace"
          (click)="openWorkspaceMenu($event)"
        >
          <app-letter-badge
            class="selected-workspace-header__badge"
            [badge]="activeWorkspaceBadge(activeWorkspaceEntry)"
          ></app-letter-badge>
          <span class="selected-workspace-header__label">
            {{ activeWorkspaceEntry.name }}
          </span>
          <span class="selected-workspace-header__chevron" aria-hidden="true"></span>
        </button>
      } @else {
        <div
          class="selected-workspace-header"
          [appTooltip]="workspaceStatusTooltip(activeWorkspaceEntry)"
        >
          <app-letter-badge
            class="selected-workspace-header__badge"
            [badge]="activeWorkspaceBadge(activeWorkspaceEntry)"
          ></app-letter-badge>
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
        /* Badge letter and name share one baseline. */
        align-items: baseline;
        gap: 0.45rem;
        width: fit-content;
        max-width: 100%;
        color: var(--foreground-color);
        font-size: 0.9rem;
        line-height: 1.2;
        min-height: 100%;
        /* (26px header - 20px badge) / 2: equal space above, below and left of the badge. */
        padding: 3px 0.75rem 3px 3px;
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

      .selected-workspace-header__badge {
        width: 20px;
        min-width: 20px;
        height: 20px;
        font-size: 14px;
        line-height: 22px;
      }

      .selected-workspace-header__chevron {
        align-self: center;
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
  imports: [LetterBadgeComponent, TooltipDirective],
})
export class SelectedWorkspaceHeaderComponent {
  private readonly workspaceEntries: Signal<ReadonlyArray<WorkspaceEntryContract>>;
  protected readonly activeWorkspace: Signal<WorkspaceEntryContract | undefined>;
  protected readonly openWorkspaceEntries: Signal<WorkspaceEntryContract[]>;
  protected readonly hasWorkspaceMenu: Signal<boolean>;
  /** When session restore is on, the workspace auto-saves (step 27g). */
  private readonly restoreEnabledSignal = signal(true);
  protected readonly restoreEnabled = this.restoreEnabledSignal.asReadonly();

  constructor(
    private readonly workspaces: WorkspaceHostApplicationService,
    private readonly contextMenuOverlayService: ContextMenuOverlayService,
    configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    configService.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((config) =>
        this.restoreEnabledSignal.set(config.terminal?.restore?.enabled ?? true),
      );
    this.workspaceEntries = this.workspaces.workspaceEntries;
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

  /** The header always shows the active workspace, so its badge leaves out the active check. */
  protected activeWorkspaceBadge(workspaceEntry: WorkspaceEntryContract): LetterBadge {
    return workspaceBadge({ ...workspaceEntry, isActive: false }, this.restoreEnabled());
  }

  protected workspaceStatusTooltip(workspaceEntry: WorkspaceEntryContract): string {
    return !this.restoreEnabled() && workspaceEntry.isDirty
      ? `${workspaceEntry.name} has unsaved workspace edits`
      : workspaceEntry.name;
  }

  private buildWorkspaceMenuItems(): ContextMenuItem[] {
    return this.openWorkspaceEntries().map((workspaceEntry) => ({
      label: workspaceEntry.name,
      badge: workspaceBadge(workspaceEntry, this.restoreEnabled()),
      action: () => {
        if (workspaceEntry.isActive) return;
        void this.workspaces.restoreWorkspaceById(workspaceEntry.id);
      },
    }));
  }
}
