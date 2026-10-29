import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { TooltipDirective } from "@cogno/shared/ui";
import { GitHunk, GitHunkLine, GitPatch } from "../model/git-patch";
import { toggled } from "./git-format";
import { GIT_SHARED_STYLES } from "./git-styles";

/** What the view offers on a hunk: the lists it can move a change to. */
export type GitHunkActions = "unstaged" | "staged" | "none";

export type GitHunkSelection = {
  readonly hunk: GitHunk;
  /** Indices into `hunk.lines`; empty for the whole hunk. */
  readonly lines: ReadonlySet<number>;
};

/**
 * The diff hunk by hunk, as git prints it: a header per hunk with the
 * actions, and the lines below, selectable with click and shift-click for
 * staging only some of them.
 */
@Component({
  selector: "app-git-hunk-view",
  standalone: true,
  imports: [TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (patch().binary) {
      <div class="empty">Binary file</div>
    } @else if (patch().hunks.length === 0) {
      <div class="empty">{{ emptyText() }}</div>
    }
    @for (hunk of patch().hunks; track $index; let hunkIndex = $index) {
      <div class="hunk">
        <div class="hunk-header">
          <span class="mono range">@@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@</span>
          <span class="ellipsis heading subtle">{{ hunk.heading }}</span>
          <span class="grow"></span>
          @if (actions() !== "none") {
            @if (selectedIn(hunkIndex) > 0) {
              <span class="small subtle">{{ selectedIn(hunkIndex) }} selected</span>
              <button type="button" class="button small" (click)="clearSelection()">Clear</button>
              @if (actions() === "unstaged") {
                <button type="button" class="button small discard" (click)="discard.emit(selection(hunkIndex))">Discard Lines</button>
                <button type="button" class="button small" (click)="stage.emit(selection(hunkIndex))">Stage Lines</button>
              } @else {
                <button type="button" class="button small" (click)="unstage.emit(selection(hunkIndex))">Unstage Lines</button>
              }
            } @else if (actions() === "unstaged") {
              <button type="button" class="button small discard" (click)="discard.emit({ hunk, lines: none })">Discard Hunk</button>
              <button type="button" class="button small" (click)="stage.emit({ hunk, lines: none })">Stage Hunk</button>
            } @else {
              <button type="button" class="button small" (click)="unstage.emit({ hunk, lines: none })">Unstage Hunk</button>
            }
          }
        </div>
        @for (line of hunk.lines; track $index; let lineIndex = $index) {
          <div class="line" [class]="'line ' + line.kind"
               [class.selected]="isSelected(hunkIndex, lineIndex)"
               [class.selectable]="actions() !== 'none' && line.kind !== 'context'"
               (click)="toggleLine(hunkIndex, lineIndex, line, $event)">
            <span class="gutter mono">{{ line.oldNumber ?? "" }}</span>
            <span class="gutter mono">{{ line.newNumber ?? "" }}</span>
            <span class="marker mono">{{ marker(line) }}</span>
            <span class="text mono">{{ line.text }}</span>
            @if (line.noNewline) {
              <span class="small subtle no-newline" appTooltip="No newline at end of file">⏎</span>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        display: block;
        height: 100%;
        overflow: auto;
        font-size: 12px;
      }
      .hunk { margin-bottom: 0.75rem; }
      .hunk-header {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: var(--git-row-height);
        padding: 0 var(--git-gutter);
        background: var(--git-hover);
        border-top: 1px solid var(--git-border);
        border-bottom: 1px solid var(--git-border);
      }
      .range { color: var(--color-cyan); white-space: nowrap; }
      .heading { flex: 0 1 auto; }
      .grow { flex: 1; }
      .line {
        display: flex;
        align-items: stretch;
        min-height: 20px;
        white-space: pre;
      }
      .line.add { background: color-mix(in srgb, var(--color-green) 14%, transparent); }
      .line.del { background: color-mix(in srgb, var(--color-red) 14%, transparent); }
      .line.selectable.add:not(.selected):hover { background: color-mix(in srgb, var(--color-green) 22%, transparent); }
      .line.selectable.del:not(.selected):hover { background: color-mix(in srgb, var(--color-red) 22%, transparent); }
      .line.selected { outline: 1px solid var(--highlight-color); outline-offset: -1px; }
      .line.selected.add { background: color-mix(in srgb, var(--color-green) 30%, transparent); }
      .line.selected.del { background: color-mix(in srgb, var(--color-red) 30%, transparent); }
      .gutter {
        flex: 0 0 3.2em;
        padding-right: 0.5em;
        text-align: right;
        color: var(--git-subtle);
        user-select: none;
        font-size: inherit;
      }
      .marker { flex: 0 0 1.2em; text-align: center; user-select: none; font-size: inherit; }
      .add .marker { color: var(--color-green); }
      .del .marker { color: var(--color-red); }
      .text { flex: 1 1 auto; font-size: inherit; padding-right: 1rem; }
      .no-newline { padding: 0 0.5rem; }
    `,
  ],
})
export class GitHunkViewComponent {
  readonly patch = input.required<GitPatch>();
  readonly actions = input<GitHunkActions>("none");
  /** Shown when there is nothing to show; depends on where the file comes from. */
  readonly emptyText = input("No changes");

  readonly stage = output<GitHunkSelection>();
  readonly unstage = output<GitHunkSelection>();
  readonly discard = output<GitHunkSelection>();

  readonly none: ReadonlySet<number> = new Set();
  /** The selected line indices; a selection lives in one hunk. */
  private readonly selected = signal<{ hunk: number; lines: ReadonlySet<number> } | null>(null);
  private lastClicked: { hunk: number; line: number } | null = null;

  isSelected(hunk: number, line: number): boolean {
    const selected = this.selected();
    return selected?.hunk === hunk && selected.lines.has(line);
  }

  selectedIn(hunk: number): number {
    const selected = this.selected();
    return selected?.hunk === hunk ? selected.lines.size : 0;
  }

  selection(hunk: number): GitHunkSelection {
    return {
      hunk: this.patch().hunks[hunk] as GitHunk,
      lines: this.selected()?.lines ?? this.none,
    };
  }

  clearSelection(): void {
    this.selected.set(null);
    this.lastClicked = null;
  }

  /** Click toggles a changed line; shift-click extends to it from the last click, within one hunk. */
  toggleLine(hunk: number, line: number, hunkLine: GitHunkLine, event: MouseEvent): void {
    if (this.actions() === "none" || hunkLine.kind === "context") return;
    const lines = this.patch().hunks[hunk]?.lines ?? [];
    const selected = this.selected();
    const current: ReadonlySet<number> = selected?.hunk === hunk ? selected.lines : this.none;
    let next: ReadonlySet<number>;
    if (event.shiftKey && this.lastClicked?.hunk === hunk) {
      const range = new Set(current);
      const [from, to] = [this.lastClicked.line, line].sort((a, b) => a - b);
      for (let index = from; index <= to; index++) {
        if (lines[index]?.kind !== "context") range.add(index);
      }
      next = range;
    } else {
      next = toggled(current, line);
    }
    this.selected.set({ hunk, lines: next });
    this.lastClicked = { hunk, line };
  }

  marker(line: GitHunkLine): string {
    return line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  }
}
