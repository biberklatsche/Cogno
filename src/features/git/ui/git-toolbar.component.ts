import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState } from "../git-view-state.service";
import { GIT_SHARED_STYLES } from "./git-styles";

/** Repository and branch, and the everyday actions: Pull, Push, Branch, Stash, Pop. */
@Component({
  selector: "app-git-toolbar",
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="start">
      <button type="button" class="button icon-button" appTooltip="Toggle branches panel"
              (click)="view.refsVisible.update(toggle)">
        <app-icon name="mdiFormatListBulleted"></app-icon>
      </button>
      <div class="repo ellipsis" [appTooltip]="repository.root() ?? ''">
        <app-icon class="small-icon subtle" name="mdiSourceRepository"></app-icon>
        <span class="ellipsis">{{ repositoryName() }}</span>
        <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
        <span class="ellipsis">{{ repository.head().branch ?? detachedLabel() }}</span>
      </div>
    </div>

    <div class="actions">
      <div class="split">
        <button type="button" class="tool" [disabled]="!onBranch() || !!operations.busy()"
                [appTooltip]="pullTooltip()" (click)="actions.pull()">
          <span class="label">{{ view.pullMode() === "fetch" ? "Fetch" : "Pull" }}</span>
          <app-icon class="tool-icon" [name]="pulling() ? 'mdiLoading' : 'mdiCloudDownloadOutline'" [class.spin]="pulling()"></app-icon>
        </button>
        <button type="button" class="tool caret" appTooltip="Pull options" [disabled]="!!operations.busy()"
                (click)="actions.openPullMenu($event)">
          <app-icon name="mdiChevronDown"></app-icon>
        </button>
      </div>
      <button type="button" class="tool" [disabled]="!onBranch() || !!operations.busy()"
              [appTooltip]="pushTooltip()" (click)="actions.pushCurrentBranch()">
        <span class="label">Push</span>
        <app-icon class="tool-icon" [name]="pushing() ? 'mdiLoading' : 'mdiCloudUploadOutline'" [class.spin]="pushing()"></app-icon>
      </button>
      <button type="button" class="tool" appTooltip="Create a branch at HEAD" [disabled]="!repository.head().sha"
              (click)="actions.beginBranch(repository.head().sha)">
        <span class="label">Branch</span>
        <app-icon class="tool-icon" name="mdiSourceBranch"></app-icon>
      </button>
      <button type="button" class="tool" appTooltip="Stash all changes" [disabled]="repository.changeCount() === 0"
              (click)="actions.stash()">
        <span class="label">Stash</span>
        <app-icon class="tool-icon" name="mdiArchiveArrowDownOutline"></app-icon>
      </button>
      <button type="button" class="tool" appTooltip="Pop Stash" [disabled]="repository.stashes().length === 0"
              (click)="actions.popLatestStash()">
        <span class="label">Pop</span>
        <app-icon class="tool-icon" name="mdiArchiveArrowUpOutline"></app-icon>
      </button>
    </div>

    <div class="end">
      <button type="button" class="button icon-button" appTooltip="Clone a repository"
              [disabled]="cloning()" (click)="actions.clone()">
        <app-icon [name]="cloning() ? 'mdiLoading' : 'mdiDownload'" [class.spin]="cloning()"></app-icon>
      </button>
      <button type="button" class="button icon-button" appTooltip="Refresh" [disabled]="repository.loading()"
              (click)="repository.refresh()">
        <app-icon name="mdiRefresh" [class.spin]="repository.loading()"></app-icon>
      </button>
    </div>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      /* The actions sit in the middle of the toolbar: the two sides share the rest equally,
         whatever is in them. */
      :host {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        padding: 0 0.25rem;
        border-bottom: 1px solid var(--git-border);
        container-type: inline-size;
      }
      .start { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
      .repo {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex: 1 1 auto;
        min-width: 4rem;
      }
      .actions { display: flex; align-items: center; gap: 2px; }
      /* Flat tools as in GitKraken's toolbar: the name above the icon,
         lifted on hover the way a tab is. Pull and its caret share one shape. */
      .tool {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        min-width: 3rem;
        height: 40px;
        padding: 0 0.5rem;
        border: 1px solid transparent;
        border-radius: var(--button-border-radius);
        background: none;
        color: var(--git-subtle);
        font: inherit;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }
      .tool:hover:not(:disabled) {
        color: var(--foreground-color);
        border-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-3)), var(--background-color));
      }
      .tool:disabled { opacity: 0.3; }
      .label { font-size: var(--git-font-small); line-height: 1.1; }
      .tool-icon { width: 1.25rem; height: 1.25rem; }
      .split { display: flex; }
      .split .tool:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
      .caret {
        min-width: 0;
        padding: 0 0.1rem;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      .caret app-icon { width: 1rem; height: 1rem; }
      .end {
        justify-self: end;
        display: flex;
        align-items: center;
        gap: 2px;
        padding-left: 0.5rem;
        border-left: 1px solid var(--git-border);
      }
      @container (max-width: 640px) {
        .label { display: none; }
      }
    `,
  ],
})
export class GitToolbarComponent {
  readonly repositoryName = computed(() => {
    const root = this.repository.root() ?? "";
    return root.split(/[\\/]/).filter(Boolean).pop() ?? root;
  });
  readonly detachedLabel = computed(() =>
    `HEAD ${this.repository.head().sha?.slice(0, 7) ?? ""}`.trim(),
  );
  readonly onBranch = computed(() => this.repository.currentBranch() !== null);
  readonly pullTooltip = computed(() => {
    if (!this.onBranch()) return "Pull is not available in a detached HEAD state";
    return this.repository.currentBranch()?.upstream
      ? `Pull from ${this.repository.currentBranch()?.upstream}`
      : "No upstream set";
  });
  readonly pushTooltip = computed(() => {
    if (!this.onBranch()) return "Push is not available in a detached HEAD state";
    const upstream = this.repository.currentBranch()?.upstream;
    return upstream ? `Push to ${upstream}` : "Publish this branch";
  });

  readonly toggle = (visible: boolean) => !visible;

  /** The running network operation shows as a spinner in its own button. */
  readonly pulling = computed(() => this.operations.busy()?.kind === "pull");
  readonly pushing = computed(() => this.operations.busy()?.kind === "push");
  readonly cloning = computed(() => this.operations.busy()?.kind === "clone");

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {}
}
