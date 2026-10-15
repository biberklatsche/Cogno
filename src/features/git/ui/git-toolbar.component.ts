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
    <button type="button" class="button icon-button" appTooltip="Toggle branches panel"
            (click)="view.refsVisible.update(toggle)">
      <app-icon name="mdiFormatListBulleted"></app-icon>
    </button>
    <div class="repo ellipsis" [appTooltip]="repository.root() ?? ''">
      <app-icon class="small-icon subtle" name="mdiSourceRepository"></app-icon>
      <span class="ellipsis">{{ repositoryName() }}</span>
      <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
      <span class="ellipsis branch">{{ repository.head().branch ?? detachedLabel() }}</span>
    </div>

    <div class="actions">
      <div class="split">
        <button type="button" class="tool" [disabled]="!onBranch() || !!operations.busy()"
                [appTooltip]="pullTooltip()" (click)="actions.pull()">
          <span class="label">{{ view.pullMode() === "fetch" ? "Fetch" : "Pull" }}</span>
          <span class="icon-row">
            <app-icon class="tool-icon pull" [name]="pulling() ? 'mdiLoading' : 'mdiCloudDownloadOutline'" [class.spin]="pulling()"></app-icon>
            @if (behind() > 0) {
              <span class="count">{{ behind() }}</span>
            }
          </span>
        </button>
        <button type="button" class="tool caret" appTooltip="Pull options" [disabled]="!!operations.busy()"
                (click)="actions.openPullMenu($event)">
          <app-icon name="mdiChevronDown"></app-icon>
        </button>
      </div>
      <button type="button" class="tool" [disabled]="!onBranch() || !!operations.busy()"
              [appTooltip]="pushTooltip()" (click)="actions.pushCurrentBranch()">
        <span class="label">Push</span>
        <span class="icon-row">
          <app-icon class="tool-icon push" [name]="pushing() ? 'mdiLoading' : 'mdiCloudUploadOutline'" [class.spin]="pushing()"></app-icon>
          @if (ahead() > 0) {
            <span class="count">{{ ahead() }}</span>
          }
        </span>
      </button>
      <button type="button" class="tool" appTooltip="Create a branch at HEAD" [disabled]="!repository.head().sha"
              (click)="actions.beginBranch(repository.head().sha)">
        <span class="label">Branch</span>
        <app-icon class="tool-icon branch" name="mdiSourceBranch"></app-icon>
      </button>
      <button type="button" class="tool" appTooltip="Stash all changes" [disabled]="repository.changeCount() === 0"
              (click)="actions.stash()">
        <span class="label">Stash</span>
        <app-icon class="tool-icon stash" name="mdiArchiveArrowDownOutline"></app-icon>
      </button>
      <button type="button" class="tool" appTooltip="Pop Stash" [disabled]="repository.stashes().length === 0"
              (click)="actions.popLatestStash()">
        <span class="label">Pop</span>
        <app-icon class="tool-icon pop" name="mdiArchiveArrowUpOutline"></app-icon>
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
      :host {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        padding: 0 0.25rem;
        border-bottom: 1px solid var(--git-border);
        container-type: inline-size;
      }
      .repo {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex: 1 1 auto;
        min-width: 4rem;
        font-weight: 500;
      }
      .branch { font-weight: 600; }
      .actions { display: flex; align-items: center; gap: 2px; margin-left: auto; }
      /* Flat tools as in GitKraken's toolbar: the name above a coloured icon,
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
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }
      .tool:hover:not(:disabled) {
        color: var(--foreground-color);
        border-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-3)), var(--background-color));
      }
      .tool:disabled { opacity: 0.3; cursor: not-allowed; }
      .label { font-size: var(--git-font-small); line-height: 1.1; }
      .icon-row { display: inline-flex; align-items: center; gap: 0.2rem; }
      .tool-icon { width: 1.25rem; height: 1.25rem; }
      .tool-icon.pull { color: var(--color-blue); }
      .tool-icon.push { color: var(--color-green); }
      .tool-icon.branch { color: var(--color-magenta); }
      .tool-icon.stash { color: var(--color-yellow); }
      .tool-icon.pop { color: var(--color-cyan); }
      .split { display: flex; }
      .split .tool:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
      .caret {
        min-width: 0;
        padding: 0 0.1rem;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      .caret app-icon { width: 1rem; height: 1rem; }
      .count {
        font-size: var(--git-font-small);
        line-height: 1.2;
        padding: 0 0.3rem;
        border-radius: 8px;
        color: var(--background-color);
        background: var(--highlight-color);
      }
      .end {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-left: 0.5rem;
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
  readonly ahead = computed(() => this.repository.currentBranch()?.ahead ?? 0);
  readonly behind = computed(() => this.repository.currentBranch()?.behind ?? 0);
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
  readonly pulling = computed(() => /^(Pull|Fetch)/.test(this.operations.busy() ?? ""));
  readonly pushing = computed(() => /^Push/.test(this.operations.busy() ?? ""));
  readonly cloning = computed(() => /^Clon/.test(this.operations.busy() ?? ""));

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {}
}
