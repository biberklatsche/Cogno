import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from "@angular/core";
import { GitConflictContent, GitDiffService } from "../git-diff.service";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import {
  conflictsOf,
  GitConflictChoice,
  GitConflictSegment,
  parseConflicts,
  resolveConflicts,
} from "../model/git-conflict";
import { GIT_SHARED_STYLES } from "./git-styles";

/** Lines of agreed text shown around a conflict; the rest folds away. */
const CONTEXT_LINES = 3;

type ConflictBlock =
  | {
      readonly kind: "text";
      readonly head: ReadonlyArray<string>;
      readonly skipped: number;
      readonly tail: ReadonlyArray<string>;
    }
  | {
      readonly kind: "conflict";
      readonly index: number;
      readonly ours: ReadonlyArray<string>;
      readonly theirs: ReadonlyArray<string>;
      readonly oursLabel: string;
      readonly theirsLabel: string;
    };

/**
 * A conflicted file, conflict by conflict: the current and the incoming side
 * next to each other, one of them or both taken per conflict, and the file
 * written and marked resolved once every conflict has its choice. A conflict
 * without markers (one side deleted the file, a binary file) is resolved by
 * taking a side as a whole.
 */
@Component({
  selector: "app-git-conflict-view",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content(); as content) {
      @if (total() > 0) {
        <div class="bar">
          <span class="small subtle">{{ chosenCount() }} of {{ total() }} conflict{{ total() === 1 ? "" : "s" }} resolved</span>
          <span class="grow"></span>
          <button type="button" class="button small" (click)="chooseAll('ours')">Take All Current</button>
          <button type="button" class="button small" (click)="chooseAll('theirs')">Take All Incoming</button>
          <button type="button" class="button small primary" [disabled]="resolved() === null || saving()" (click)="save()">
            Save and Mark Resolved
          </button>
        </div>
        <div class="blocks">
          @for (block of blocks(); track $index) {
            @if (block.kind === "text") {
              @for (line of block.head; track $index) {
                <div class="line mono">{{ line }}</div>
              }
              @if (block.skipped > 0) {
                <div class="line skipped small subtle">⋯ {{ block.skipped }} unchanged line{{ block.skipped === 1 ? "" : "s" }}</div>
              }
              @for (line of block.tail; track $index) {
                <div class="line mono">{{ line }}</div>
              }
            } @else {
              <div class="conflict" [class.chosen]="choices()[block.index]">
                <div class="conflict-header">
                  <span class="small subtle">Conflict {{ block.index + 1 }}</span>
                  <span class="grow"></span>
                  <button type="button" class="button small" [class.active]="choices()[block.index] === 'ours'"
                          (click)="choose(block.index, 'ours')">Take Current</button>
                  <button type="button" class="button small" [class.active]="choices()[block.index] === 'theirs'"
                          (click)="choose(block.index, 'theirs')">Take Incoming</button>
                  <button type="button" class="button small" [class.active]="choices()[block.index] === 'both'"
                          (click)="choose(block.index, 'both')">Take Both</button>
                </div>
                <div class="sides">
                  <div class="side ours" [class.taken]="takes(block.index, 'ours')" [class.dropped]="drops(block.index, 'ours')">
                    <div class="side-label small subtle ellipsis">Current · {{ block.oursLabel }}</div>
                    @for (line of block.ours; track $index) {
                      <div class="line mono">{{ line }}</div>
                    } @empty {
                      <div class="line small subtle">(nothing)</div>
                    }
                  </div>
                  <div class="side theirs" [class.taken]="takes(block.index, 'theirs')" [class.dropped]="drops(block.index, 'theirs')">
                    <div class="side-label small subtle ellipsis">Incoming · {{ block.theirsLabel }}</div>
                    @for (line of block.theirs; track $index) {
                      <div class="line mono">{{ line }}</div>
                    } @empty {
                      <div class="line small subtle">(nothing)</div>
                    }
                  </div>
                </div>
              </div>
            }
          }
        </div>
      } @else {
        <div class="whole">
          <span>{{ wholeFileText(content) }}</span>
          <div class="whole-actions">
            <button type="button" class="button small" [disabled]="saving()" (click)="takeSide('ours')">
              {{ content.hasOurs ? "Take Current" : "Take Current (delete file)" }}
            </button>
            <button type="button" class="button small" [disabled]="saving()" (click)="takeSide('theirs')">
              {{ content.hasTheirs ? "Take Incoming" : "Take Incoming (delete file)" }}
            </button>
            @if (content.hasOurs && content.hasTheirs) {
              <button type="button" class="button small primary" [disabled]="saving()" (click)="markResolved()">
                Mark Resolved
              </button>
            }
          </div>
        </div>
      }
    } @else {
      <div class="empty small subtle">Loading conflict…</div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: 12px; }
      .bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: var(--git-row-height);
        padding: 0.25rem var(--git-gutter);
        border-bottom: 1px solid var(--git-border);
      }
      .grow { flex: 1; }
      .small { font-size: var(--git-font-small); }
      .subtle { color: var(--git-subtle); }
      .blocks { flex: 1 1 auto; overflow: auto; padding-bottom: 1rem; }
      .line { min-height: 20px; padding: 0 var(--git-gutter); white-space: pre; }
      .skipped { display: flex; align-items: center; user-select: none; }
      .conflict {
        margin: 0.25rem 0;
        border-top: 1px solid var(--color-red);
        border-bottom: 1px solid var(--color-red);
      }
      .conflict.chosen { border-color: var(--git-border); }
      .conflict-header {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-height: var(--git-row-height);
        padding: 0 var(--git-gutter);
        background: var(--git-hover);
      }
      .conflict-header .active { outline: 1px solid var(--highlight-color); outline-offset: -1px; }
      .sides { display: grid; grid-template-columns: 1fr 1fr; }
      .side { min-width: 0; overflow-x: auto; }
      .side + .side { border-left: 1px solid var(--git-border); }
      .side-label { padding: 0.15rem var(--git-gutter); }
      .side.ours { background: color-mix(in srgb, var(--color-cyan) 8%, transparent); }
      .side.theirs { background: color-mix(in srgb, var(--color-magenta) 8%, transparent); }
      .side.taken { background: color-mix(in srgb, var(--color-green) 16%, transparent); }
      .side.dropped { opacity: 0.45; }
      .side.dropped .line.mono { text-decoration: line-through; }
      .whole { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem var(--git-gutter); }
      .whole-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .empty { padding: 1rem var(--git-gutter); }
    `,
  ],
})
export class GitConflictViewComponent {
  /** The conflicted file, repository-relative. */
  readonly path = input.required<string>();

  readonly content = signal<GitConflictContent | null>(null);
  readonly saving = signal(false);
  readonly choices = signal<ReadonlyArray<GitConflictChoice | null>>([]);

  private readonly segments = computed<ReadonlyArray<GitConflictSegment>>(() =>
    parseConflicts(this.content()?.text ?? ""),
  );
  readonly total = computed(() => conflictsOf(this.segments()).length);
  readonly chosenCount = computed(() => this.choices().filter(Boolean).length);
  readonly resolved = computed(() => resolveConflicts(this.segments(), this.choices()));
  readonly blocks = computed(() => toBlocks(this.segments()));

  constructor(
    private readonly repository: GitRepositoryService,
    private readonly operations: GitOperationsService,
    private readonly diffs: GitDiffService,
  ) {
    // Re-read when another file is shown or the repository was re-read: the
    // file may have been edited elsewhere. Choices stay while the text does.
    effect(() => {
      const path = this.path();
      this.repository.status();
      untracked(() => void this.load(path));
    });
  }

  choose(index: number, choice: GitConflictChoice): void {
    this.choices.update((choices) => {
      const next = [...choices];
      next[index] = next[index] === choice ? null : choice;
      return next;
    });
  }

  chooseAll(choice: GitConflictChoice): void {
    this.choices.set(Array.from({ length: this.total() }, () => choice));
  }

  takes(index: number, side: "ours" | "theirs"): boolean {
    const choice = this.choices()[index];
    return choice === side || choice === "both";
  }

  drops(index: number, side: "ours" | "theirs"): boolean {
    const choice = this.choices()[index];
    return !!choice && !this.takes(index, side);
  }

  wholeFileText(content: GitConflictContent): string {
    if (!content.hasOurs) return "Deleted on the current side, changed on the incoming side.";
    if (!content.hasTheirs) return "Changed on the current side, deleted on the incoming side.";
    return "No conflict markers in this file (a binary file, or already edited). Take a side, or mark it resolved as it is.";
  }

  save(): Promise<void> {
    const resolved = this.resolved();
    if (resolved === null) return Promise.resolve();
    return this.whileSaving(() => this.operations.resolveConflict(this.path(), resolved));
  }

  takeSide(side: "ours" | "theirs"): Promise<void> {
    return this.whileSaving(() => this.operations.takeConflictSide(this.path(), side));
  }

  markResolved(): Promise<void> {
    return this.whileSaving(() => this.operations.markResolved(this.path()));
  }

  private async whileSaving(action: () => Promise<unknown>): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await action();
    } finally {
      this.saving.set(false);
    }
  }

  private async load(path: string): Promise<void> {
    const previous = this.content();
    const content = await this.diffs.loadConflict(path);
    if (path !== this.path()) return;
    if (
      previous?.text === content.text &&
      previous.hasOurs === content.hasOurs &&
      previous.hasTheirs === content.hasTheirs
    ) {
      return;
    }
    this.content.set(content);
    this.choices.set([]);
  }
}

/** The file as blocks to show: conflicts whole, agreed text folded to its edges. */
function toBlocks(segments: ReadonlyArray<GitConflictSegment>): ConflictBlock[] {
  let conflictIndex = 0;
  return segments.map((segment, position) => {
    if (segment.kind === "conflict") {
      return {
        kind: "conflict",
        index: conflictIndex++,
        ours: linesOf(segment.ours),
        theirs: linesOf(segment.theirs),
        oursLabel: segment.oursLabel,
        theirsLabel: segment.theirsLabel,
      };
    }
    const lines = linesOf(segment.text);
    const before = position > 0 ? CONTEXT_LINES : 0;
    const after = position < segments.length - 1 ? CONTEXT_LINES : 0;
    if (lines.length <= before + after + 1) {
      return { kind: "text", head: lines, skipped: 0, tail: [] };
    }
    return {
      kind: "text",
      head: lines.slice(0, before),
      skipped: lines.length - before - after,
      tail: lines.slice(lines.length - after),
    };
  });
}

/** The lines of a piece of the file, without their endings. */
function linesOf(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
