import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  signal,
  WritableSignal,
} from "@angular/core";
import { DIALOG_DATA, DialogRef, ToggleSwitchComponent } from "@cogno/shared/ui";

export type GitDeleteBranchesItem = {
  readonly name: string;
  /** Secondary text after the name: age, `gone`. */
  readonly detail: string;
  /** Why the branch cannot be deleted here; it is listed but not selectable. */
  readonly keptReason: string | null;
};

export type GitDeleteBranchesDialogData = {
  readonly message: string;
  readonly items: ReadonlyArray<GitDeleteBranchesItem>;
  /** The switch that also deletes the tracked remote branches; none hides it. */
  readonly remoteOption?: GitDeleteBranchesRemoteOption;
};

export type GitDeleteBranchesRemoteOption = {
  readonly label: string;
  /** The remote branches that go along with the chosen branches, by name. */
  readonly remoteBranchesFor: (names: ReadonlyArray<string>) => ReadonlyArray<string>;
};

export type GitDeleteBranchesResult = {
  readonly names: ReadonlyArray<string>;
  readonly alsoRemote: boolean;
};

/** The branches a bulk delete would remove, each one to tick off. */
@Component({
  selector: "app-git-delete-branches-dialog",
  standalone: true,
  imports: [ToggleSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="delete-branches">
      <p class="message">{{ data.message }}</p>
      <label class="all">
        <input type="checkbox" [checked]="allSelected()" [indeterminate]="someSelected()"
               [disabled]="selectable.length === 0" (change)="toggleAll()" />
        <span>All</span>
        <span class="grow"></span>
        <span class="subtle">{{ selected().size }} / {{ selectable.length }}</span>
      </label>
      <div class="list">
        @for (item of data.items; track item.name) {
          <label class="item" [class.kept]="item.keptReason">
            <input type="checkbox" [checked]="selected().has(item.name)"
                   [disabled]="!!item.keptReason" (change)="toggle(item.name)" />
            <span class="name">{{ item.name }}</span>
            <span class="subtle">{{ item.keptReason ?? item.detail }}</span>
          </label>
        }
      </div>
      @if (data.remoteOption; as option) {
        <button type="button" class="remote-option" (click)="alsoRemote.set(!alsoRemote())">
          <app-toggle-switch [checked]="alsoRemote()"></app-toggle-switch>
          <span>{{ option.label }}</span>
        </button>
        @if (alsoRemote()) {
          <p class="remote-list subtle">
            @if (remoteBranches().length > 0) {
              Also deletes {{ remoteBranches().join(", ") }}
            } @else {
              None to delete: no upstream, still tracked by another branch, or a default branch
            }
          </p>
        }
      }
      <div class="actions">
        <button type="button" class="button" (click)="dismiss()">Cancel</button>
        <button type="button" class="button primary" [disabled]="selected().size === 0" (click)="confirm()">
          Delete {{ selected().size }} {{ selected().size === 1 ? "branch" : "branches" }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .delete-branches {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: min(28rem, calc(100vw - 2rem));
      }
      .message { margin: 0; line-height: 1.5; }
      .subtle { opacity: 0.6; white-space: nowrap; }
      .grow { flex: 1; }
      input[type="checkbox"] { accent-color: var(--highlight-color); margin: 0; }
      .all, .item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.2rem 0.4rem;
      }
      .all {
        border-bottom: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        padding-bottom: 0.4rem;
      }
      .list {
        max-height: 50vh;
        overflow: auto;
      }
      .item .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .item.kept { opacity: 0.5; }
      .remote-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: none;
        border: none;
        padding: 0;
        color: inherit;
        font: inherit;
        text-align: left;
      }
      .remote-list { margin: 0; white-space: normal; line-height: 1.5; }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
})
export class GitDeleteBranchesDialogComponent {
  readonly selectable: ReadonlyArray<string>;
  readonly selected: WritableSignal<ReadonlySet<string>>;
  readonly alsoRemote = signal(false);
  readonly allSelected = computed(
    () => this.selectable.length > 0 && this.selected().size === this.selectable.length,
  );
  readonly someSelected = computed(() => this.selected().size > 0 && !this.allSelected());
  readonly remoteBranches = computed(
    () => this.data.remoteOption?.remoteBranchesFor(this.chosen()) ?? [],
  );

  constructor(
    private readonly dialogRef: DialogRef<GitDeleteBranchesResult>,
    @Inject(DIALOG_DATA) readonly data: GitDeleteBranchesDialogData,
  ) {
    this.selectable = data.items.filter((item) => !item.keptReason).map((item) => item.name);
    this.selected = signal<ReadonlySet<string>>(new Set(this.selectable));
  }

  toggle(name: string): void {
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  toggleAll(): void {
    this.selected.set(new Set(this.allSelected() ? [] : this.selectable));
  }

  confirm(): void {
    this.dialogRef.close({ names: this.chosen(), alsoRemote: this.alsoRemote() });
  }

  dismiss(): void {
    this.dialogRef.close();
  }

  /** The selected branches in the order of the list, not of the clicks. */
  private chosen(): ReadonlyArray<string> {
    return this.selectable.filter((name) => this.selected().has(name));
  }
}
