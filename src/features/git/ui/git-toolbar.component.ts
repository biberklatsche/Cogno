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
        <button type="button" class="button tool" [disabled]="!onBranch() || !!operations.busy()"
                [appTooltip]="pullTooltip()" (click)="actions.pull()">
          <app-icon name="mdiCloudDownloadOutline"></app-icon>
          <span class="label">{{ view.pullMode() === "fetch" ? "Fetch" : "Pull" }}</span>
          @if (behind() > 0) {
            <span class="count">{{ behind() }}</span>
          }
        </button>
        <button type="button" class="button tool caret" appTooltip="Pull options" [disabled]="!!operations.busy()"
                (click)="actions.openPullMenu($event)">
          <app-icon name="mdiChevronDown"></app-icon>
        </button>
      </div>
      <button type="button" class="button tool" [disabled]="!onBranch() || !!operations.busy()"
              [appTooltip]="pushTooltip()" (click)="actions.pushCurrentBranch()">
        <app-icon name="mdiCloudUploadOutline"></app-icon>
        <span class="label">Push</span>
        @if (ahead() > 0) {
          <span class="count">{{ ahead() }}</span>
        }
      </button>
      <button type="button" class="button tool" appTooltip="Create a branch at HEAD" [disabled]="!repository.head().sha"
              (click)="actions.createBranchAt('HEAD', repository.head().branch ?? 'HEAD')">
        <app-icon name="mdiSourceBranch"></app-icon>
        <span class="label">Branch</span>
      </button>
      <button type="button" class="button tool" appTooltip="Stash all changes" [disabled]="repository.changeCount() === 0"
              (click)="actions.stash()">
        <app-icon name="mdiArchiveArrowDownOutline"></app-icon>
        <span class="label">Stash</span>
      </button>
      <button type="button" class="button tool" appTooltip="Pop Stash" [disabled]="repository.stashes().length === 0"
              (click)="actions.popLatestStash()">
        <app-icon name="mdiArchiveArrowUpOutline"></app-icon>
        <span class="label">Pop</span>
      </button>
    </div>

    <div class="end">
      @if (operations.busy(); as busy) {
        <span class="busy ellipsis subtle">
          <app-icon class="small-icon spin" name="mdiLoading"></app-icon>{{ busy }}…
        </span>
      }
      <button type="button" class="button icon-button" appTooltip="Clone a repository" (click)="actions.clone()">
        <app-icon name="mdiDownload"></app-icon>
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
        min-height: 36px;
        padding: 0 0.25rem;
        border-bottom: 1px solid var(--git-border);
        container-type: inline-size;
      }
      .repo {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex: 0 1 auto;
        min-width: 4rem;
        font-weight: 500;
      }
      .branch { font-weight: 600; }
      .actions { display: flex; align-items: center; gap: 2px; margin: 0 auto; }
      .split { display: flex; }
      .tool {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.45rem;
      }
      .tool app-icon { width: 1.05rem; height: 1.05rem; }
      .caret { padding: 0.2rem 0.1rem; }
      .caret app-icon { width: 0.9rem; height: 0.9rem; }
      .count {
        font-size: var(--git-font-small);
        padding: 0 0.3rem;
        border-radius: 8px;
        background: var(--git-hover);
      }
      .end { display: flex; align-items: center; gap: 2px; min-width: 0; }
      .busy { display: inline-flex; align-items: center; gap: 0.3rem; max-width: 14rem; }
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

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {}
}
