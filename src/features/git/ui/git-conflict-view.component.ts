import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from "@angular/core";
import { Annotation } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitConflictContent, GitDiffService } from "../git-diff.service";
import { detectGitDiffLanguage } from "../git-diff-languages";
import { GitConflictTake, GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import {
  conflictRows,
  conflictsOf,
  GitConflictPick,
  GitConflictSegment,
  GitConflictSide,
  parseConflicts,
  resolveConflicts,
} from "../model/git-conflict";
import { gitEditorLook } from "./git-diff-view.component";
import { GIT_SHARED_STYLES } from "./git-styles";

/** Marks the output changes the view makes itself, as opposed to typing. */
const fromPicks = Annotation.define<boolean>();

/** A choice for a file whose conflict cannot be shown line by line. */
type WholeFileAction = { readonly label: string; readonly take: GitConflictTake | "as-is" };

/** A conflict as read, with the file it was read for. */
type LoadedConflict = GitConflictContent & { readonly path: string };

/**
 * A conflicted file as GitKraken shows it: the current side (A) and the
 * incoming side (B) above, level line by line, a checkbox per conflict and
 * per side, and below the output - the file as it will be saved, built from
 * what is ticked in the order it was ticked, and editable by hand. Saving
 * writes the output and marks the file resolved. A conflict without markers
 * (one side deleted the file, a binary file) is resolved as a whole.
 */
@Component({
  selector: "app-git-conflict-view",
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content(); as content) {
      @if (total() === 0) {
        <div class="prompt">
          <span>{{ wholeFileText(content) }}</span>
          <span class="actions">
            @for (action of wholeFileActions(content); track action.take) {
              <button type="button" class="button small" [class.primary]="$first" [disabled]="saving()"
                      (click)="resolveWhole(action.take)">{{ action.label }}</button>
            }
          </span>
        </div>
      } @else {
        <div class="panes">
          @for (pane of panes(); track pane.side) {
            <div class="pane" [class]="'pane ' + pane.side">
              <div class="pane-header">
                <input type="checkbox" [checked]="takesAll(pane.side)" [indeterminate]="takesSome(pane.side)"
                       [attr.aria-label]="'Take every conflict from ' + pane.label" (change)="toggleAll(pane.side)" />
                <span class="badge">{{ pane.side === "ours" ? "A" : "B" }}</span>
                <span class="ellipsis">
                  @if (pane.sha) {
                    Commit {{ pane.sha }}
                    @if (pane.name) { on <em class="name">{{ pane.name }}</em> }
                  } @else {
                    <em class="name">{{ pane.name }}</em>
                  }
                </span>
              </div>
              <div #paneBody class="pane-body" (scroll)="syncScroll($event)">
                @for (row of pane.rows; track $index) {
                  <div class="row"
                       [class.conflict]="row.conflict !== null"
                       [class.taken]="row.conflict !== null && takes(row.conflict, pane.side)"
                       [class.filler]="row.number === null"
                       [class.current]="row.conflict === current()"
                       [attr.data-conflict]="row.first ? row.conflict : null">
                    <span class="check">
                      @if (row.first && row.conflict !== null) {
                        <input type="checkbox" [checked]="takes(row.conflict, pane.side)"
                               [attr.aria-label]="'Take conflict ' + (row.conflict + 1) + ' from ' + pane.label"
                               (change)="toggle(row.conflict, pane.side)" />
                      }
                    </span>
                    <span class="gutter mono">{{ row.number ?? "" }}</span>
                    <span class="text mono">{{ row.text }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
        <div class="output-header">
          <span class="title">Output</span>
          @if (edited()) {
            <span class="small subtle" appTooltip="Ticking a box again rebuilds the output and drops the edits">edited</span>
          }
          <span class="grow"></span>
          <span class="small nav-label">conflict {{ current() + 1 }} of {{ total() }}</span>
          <button type="button" class="button icon-button" appTooltip="Previous conflict"
                  [disabled]="current() === 0" (click)="goTo(current() - 1)">
            <app-icon name="mdiChevronUp"></app-icon>
          </button>
          <button type="button" class="button icon-button" appTooltip="Next conflict"
                  [disabled]="current() >= total() - 1" (click)="goTo(current() + 1)">
            <app-icon name="mdiChevronDown"></app-icon>
          </button>
          <span class="grow"></span>
          <span class="small subtle">{{ pickedCount() }} of {{ total() }} decided</span>
          <button type="button" class="button small primary" [disabled]="!canSave() || saving()"
                  [appTooltip]="canSave() ? 'Save the output and mark the file resolved' : 'Tick a side for every conflict, or edit the output'"
                  (click)="save()">Save</button>
        </div>
        <div #output class="output"></div>
      }
    } @else {
      <div class="empty small subtle">Loading conflict…</div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        --conflict-ours: var(--color-cyan);
        --conflict-theirs: var(--color-yellow);
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .grow { flex: 1; }
      .prompt {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.6rem var(--git-gutter);
        background: var(--git-hover);
        border-bottom: 1px solid var(--git-border);
      }
      .prompt .actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .panes { flex: 1 1 50%; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
      .pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
      .pane + .pane { border-left: 1px solid var(--git-border); }
      .pane-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-height: var(--git-row-height);
        padding: 0 var(--git-gutter);
        border-bottom: 1px solid var(--git-border);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.2rem;
        height: 1.2rem;
        border: 1px solid currentColor;
        border-radius: 2px;
        font-weight: bold;
      }
      .ours .badge, .ours .name { color: var(--conflict-ours); }
      .theirs .badge, .theirs .name { color: var(--conflict-theirs); }
      .pane-body { flex: 1 1 auto; overflow: auto; min-height: 0; }
      /* Sizes follow the app font size the user set: the code is .mono (0.85em of the panel). */
      .row { display: flex; align-items: center; min-height: 1.45em; white-space: pre; width: max-content; min-width: 100%; }
      .check { flex: 0 0 1.4rem; display: flex; justify-content: center; }
      .check input { margin: 0; }
      .gutter { flex: 0 0 3.2em; padding-right: 0.6em; text-align: right; color: var(--git-subtle); user-select: none; }
      .text { flex: 1 1 auto; padding-right: 1rem; }
      .ours .row.conflict { background: color-mix(in srgb, var(--conflict-ours) 10%, transparent); }
      .theirs .row.conflict { background: color-mix(in srgb, var(--conflict-theirs) 10%, transparent); }
      .ours .row.taken { background: color-mix(in srgb, var(--conflict-ours) 28%, transparent); }
      .theirs .row.taken { background: color-mix(in srgb, var(--conflict-theirs) 28%, transparent); }
      .ours .row.current .text { box-shadow: inset 2px 0 var(--conflict-ours); }
      .theirs .row.current .text { box-shadow: inset 2px 0 var(--conflict-theirs); }
      .row.filler .text {
        background: repeating-linear-gradient(135deg, transparent 0 4px, var(--git-border) 4px 5px);
      }
      .output-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-height: var(--git-row-height);
        padding: 0.15rem var(--git-gutter);
        border-top: 1px solid var(--git-border);
        border-bottom: 1px solid var(--git-border);
      }
      .output-header .title { font-size: 1.1em; }
      .nav-label { color: var(--highlight-color); }
      .output { flex: 1 1 40%; min-height: 0; position: relative; }
      .output ::ng-deep .cm-editor { position: absolute; inset: 0; }
      .output ::ng-deep .cm-editor.cm-focused { outline: none; }
      .empty { padding: 1rem var(--git-gutter); }
    `,
  ],
})
export class GitConflictViewComponent implements OnDestroy {
  /** The conflicted file, repository-relative. */
  readonly path = input.required<string>();

  /** The file on screen; null while another one loads. */
  readonly content = signal<LoadedConflict | null>(null);
  readonly saving = signal(false);
  /** Per conflict, the sides ticked, in the order they were ticked. */
  readonly picks = signal<ReadonlyArray<GitConflictPick>>([]);
  /** The conflict the navigation is on. */
  readonly current = signal(0);
  /** The output was typed into since the boxes last built it. */
  readonly edited = signal(false);

  private readonly segments = computed<ReadonlyArray<GitConflictSegment>>(() =>
    parseConflicts(this.content()?.text ?? ""),
  );
  readonly total = computed(() => conflictsOf(this.segments()).length);
  readonly pickedCount = computed(
    () => this.picks().filter((pick) => pick && pick.length > 0).length,
  );
  readonly canSave = computed(() => this.pickedCount() === this.total() || this.edited());
  readonly resolution = computed(() => resolveConflicts(this.segments(), this.picks()));

  /** What the sides are called: the commits and branches, or the conflict markers' labels. */
  private readonly names = computed(() => {
    const first = conflictsOf(this.segments())[0];
    const head = this.repository.head();
    const incoming = this.repository.incoming();
    return {
      ours: {
        sha: head.sha?.slice(0, 7) ?? null,
        name: head.branch ?? first?.oursLabel ?? "current",
      },
      theirs: {
        sha: incoming?.sha.slice(0, 7) ?? null,
        name: incoming?.name ?? first?.theirsLabel ?? "incoming",
      },
    };
  });
  readonly panes = computed(() =>
    (["ours", "theirs"] as const).map((side) => ({
      side,
      ...this.names()[side],
      label: this.names()[side].name,
      rows: conflictRows(this.segments(), side),
    })),
  );

  private readonly paneBodies = viewChildren<ElementRef<HTMLElement>>("paneBody");
  private readonly outputHost = viewChild<ElementRef<HTMLElement>>("output");
  private editor: EditorView | null = null;
  private editorPath: string | null = null;
  private building = 0;
  private syncingScroll = false;

  constructor(
    private readonly repository: GitRepositoryService,
    private readonly operations: GitOperationsService,
    private readonly diffs: GitDiffService,
  ) {
    // Re-read when another file is shown or the repository was re-read: the
    // file may have been edited elsewhere. Ticks stay while the text does.
    effect(() => {
      const path = this.path();
      this.repository.status();
      untracked(() => void this.load(path));
    });

    // The output editor, built once its host is there, for the file shown.
    effect(() => {
      const host = this.outputHost()?.nativeElement;
      const content = this.content();
      untracked(() => void this.buildEditor(host, content));
    });

    // The ticks rebuild the output.
    effect(() => {
      const text = this.resolution().text;
      untracked(() => this.showInOutput(text));
    });
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }

  takes(conflict: number, side: GitConflictSide): boolean {
    return this.picks()[conflict]?.includes(side) ?? false;
  }

  takesAll(side: GitConflictSide): boolean {
    return this.total() > 0 && this.countTaking(side) === this.total();
  }

  takesSome(side: GitConflictSide): boolean {
    const count = this.countTaking(side);
    return count > 0 && count < this.total();
  }

  toggle(conflict: number, side: GitConflictSide): void {
    this.picks.update((picks) => {
      const next = [...picks];
      const pick = next[conflict] ?? [];
      next[conflict] = pick.includes(side) ? pick.filter((s) => s !== side) : [...pick, side];
      return next;
    });
    this.current.set(conflict);
  }

  /** Ticks the side for every conflict, or unticks it where every conflict had it. */
  toggleAll(side: GitConflictSide): void {
    const take = !this.takesAll(side);
    this.picks.update((picks) =>
      Array.from({ length: this.total() }, (_, index) => {
        const pick = (picks[index] ?? []).filter((s) => s !== side);
        return take ? [...pick, side] : pick;
      }),
    );
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.total()) return;
    this.current.set(index);
    const body = this.paneBodies()[0]?.nativeElement;
    const row = body?.querySelector<HTMLElement>(`[data-conflict="${index}"]`);
    if (body && row) body.scrollTop = row.offsetTop - body.offsetTop - body.clientHeight / 3;
    const start = this.resolution().starts[index];
    if (this.editor && start !== undefined && !this.edited()) {
      this.editor.dispatch({
        effects: EditorView.scrollIntoView(start, { y: "start", yMargin: 40 }),
      });
    }
  }

  /** A and B scroll together; their rows are level. */
  syncScroll(event: Event): void {
    if (this.syncingScroll) return;
    const source = event.target as HTMLElement;
    this.syncingScroll = true;
    for (const body of this.paneBodies()) {
      const element = body.nativeElement;
      if (element === source) continue;
      element.scrollTop = source.scrollTop;
      element.scrollLeft = source.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.syncingScroll = false;
    });
  }

  wholeFileText(content: LoadedConflict): string {
    const { ours, theirs } = this.sideNames();
    const { path } = content;
    if (!content.hasBase && !content.hasOurs && !content.hasTheirs) {
      return `${path} is no longer conflicted.`;
    }
    if (!content.hasOurs && !content.hasTheirs) {
      return `${path} has been deleted on both ${ours} and ${theirs}.`;
    }
    if (!content.hasTheirs) {
      return `${path} has been modified on ${ours}, but deleted on ${theirs}.`;
    }
    if (!content.hasOurs) return `${path} has been deleted on ${ours}, but modified on ${theirs}.`;
    return `${path} differs on ${ours} and ${theirs} in a way that cannot be shown line by line (a binary file, or the markers were removed).`;
  }

  wholeFileActions(content: LoadedConflict): WholeFileAction[] {
    const { ours, theirs } = this.sideNames();
    const base: WholeFileAction[] = content.hasBase
      ? [{ label: "Keep Base Version", take: "base" }]
      : [];
    if (!content.hasOurs && !content.hasTheirs) {
      // Nothing left to resolve, or deleted on both sides: delete it or keep the base.
      return content.hasBase ? [{ label: "Delete the File", take: "ours" }, ...base] : [];
    }
    if (!content.hasTheirs || !content.hasOurs) {
      const modified = content.hasOurs ? "ours" : "theirs";
      return [
        { label: "Keep Modified Version", take: modified },
        { label: "Delete the File", take: modified === "ours" ? "theirs" : "ours" },
        ...base,
      ];
    }
    return [
      { label: `Keep ${ours} Version`, take: "ours" },
      { label: `Keep ${theirs} Version`, take: "theirs" },
      ...base,
      { label: "Mark Resolved As It Is", take: "as-is" },
    ];
  }

  /** Acts on the file whose state is on screen, never on one still loading. */
  resolveWhole(take: GitConflictTake | "as-is"): Promise<void> {
    const loaded = this.content();
    if (!loaded) return Promise.resolve();
    return this.whileSaving(() =>
      take === "as-is"
        ? this.operations.markResolved([loaded.path])
        : this.operations.takeConflictSide(loaded.path, take),
    );
  }

  /** Writes the output to the file it was built from, never to one still loading. */
  save(): Promise<void> {
    const loaded = this.content();
    if (!loaded || !this.canSave()) return Promise.resolve();
    const text = this.editor?.state.doc.toString() ?? this.resolution().text;
    return this.whileSaving(() => this.operations.resolveConflict(loaded.path, text));
  }

  private sideNames(): { ours: string; theirs: string } {
    const names = this.names();
    return { ours: names.ours.name, theirs: names.theirs.name };
  }

  private countTaking(side: GitConflictSide): number {
    return this.picks().filter((pick) => pick?.includes(side)).length;
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

  /**
   * Another file starts blank at once, so nothing of the previous one can be
   * saved onto it. A re-read of the same file keeps the ticks while its text
   * and sides are unchanged.
   */
  private async load(path: string): Promise<void> {
    const previous = this.content();
    const samePath = previous?.path === path;
    if (!samePath) this.show(null);
    const content = await this.diffs.loadConflict(path);
    if (path !== this.path()) return;
    if (
      samePath &&
      previous.text === content.text &&
      previous.hasBase === content.hasBase &&
      previous.hasOurs === content.hasOurs &&
      previous.hasTheirs === content.hasTheirs
    ) {
      return;
    }
    this.show({ ...content, path });
  }

  private show(content: LoadedConflict | null): void {
    this.content.set(content);
    this.picks.set([]);
    this.current.set(0);
    this.edited.set(false);
  }

  private async buildEditor(
    host: HTMLElement | undefined,
    content: LoadedConflict | null,
  ): Promise<void> {
    if (!host || !content) {
      this.destroyEditor();
      return;
    }
    const { path } = content;
    // The same file in the same host keeps its editor; the ticks update it.
    if (this.editor && this.editorPath === path && this.editor.dom.parentElement === host) return;
    this.destroyEditor();
    const build = ++this.building;
    const look = await gitEditorLook(detectGitDiffLanguage(path));
    if (build !== this.building) return;
    this.editor = new EditorView({
      parent: host,
      doc: this.resolution().text,
      extensions: [
        ...look,
        EditorView.updateListener.of((update) => {
          const typed = update.transactions.some(
            (transaction) => transaction.docChanged && !transaction.annotation(fromPicks),
          );
          if (typed) this.edited.set(true);
        }),
      ],
    });
    this.editorPath = path;
  }

  private showInOutput(text: string): void {
    const editor = this.editor;
    if (!editor) return;
    if (editor.state.doc.toString() !== text) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        annotations: fromPicks.of(true),
      });
    }
    this.edited.set(false);
  }

  private destroyEditor(): void {
    this.building++;
    this.editor?.destroy();
    this.editor = null;
    this.editorPath = null;
  }
}
