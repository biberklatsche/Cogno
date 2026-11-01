import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitFileListMode } from "../git-view-state.service";
import { buildFileTree, GitFileTreeRow } from "../model/git-file-tree";
import { GitFile } from "../model/git-model";
import { fileDir, fileName, fileStatusClass, fileStatusIcon, toggled } from "./git-format";
import { GIT_SHARED_STYLES } from "./git-styles";

/** Which actions a list offers on its rows. */
type GitFileListKind = "unstaged" | "staged" | "conflicted" | "commit";

/**
 * Files as a flat path list or a folder tree, with the row actions their list
 * offers: stage, unstage, discard, mark resolved. A click opens the diff.
 */
@Component({
  selector: "app-git-file-list",
  standalone: true,
  imports: [IconComponent, NgTemplateOutlet, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === "tree") {
      @for (row of treeRows(); track rowKey(row)) {
        @if (row.kind === "dir") {
          <div class="row" [style.padding-left.rem]="0.5 + row.depth * 0.9" (click)="toggleFolder(row.path)">
            <app-icon class="small-icon subtle" [name]="collapsed().has(row.path) ? 'mdiChevronRight' : 'mdiChevronDown'"></app-icon>
            <app-icon class="small-icon subtle" name="mdiFolderOutline"></app-icon>
            <span class="ellipsis grow">{{ row.name }}</span>
            @if (kind() === "unstaged" || kind() === "staged") {
              <button type="button" class="button icon-button row-action"
                      [appTooltip]="kind() === 'unstaged' ? 'Stage folder' : 'Unstage folder'"
                      (click)="$event.stopPropagation(); primary.emit([row.path])">
                <app-icon [name]="kind() === 'unstaged' ? 'mdiPlus' : 'mdiMinus'"></app-icon>
              </button>
            }
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="fileRow; context: { $implicit: row.file, depth: row.depth, label: row.name, dir: '' }"></ng-container>
        }
      }
    } @else {
      @for (file of files(); track file.path) {
        <ng-container *ngTemplateOutlet="fileRow; context: { $implicit: file, depth: 0, label: name(file.path), dir: dir(file.path) }"></ng-container>
      }
    }

    <ng-template #fileRow let-file let-depth="depth" let-label="label" let-dir="dir">
      <div class="row" [class.selected]="file.path === selectedPath()"
           [style.padding-left.rem]="0.5 + depth * 0.9 + (mode() === 'tree' ? 0.9 : 0)"
           (click)="open.emit(file)" (contextmenu)="menu.emit({ event: $event, file })">
        <app-icon [class]="'small-icon ' + statusClass(file)" [name]="statusIcon(file)"></app-icon>
        <span class="ellipsis name" [appTooltip]="file.oldPath ? file.oldPath + ' → ' + file.path : file.path">{{ label }}</span>
        <span class="ellipsis subtle dir">{{ dir }}</span>
        @switch (kind()) {
          @case ("unstaged") {
            <button type="button" class="button icon-button row-action" appTooltip="Discard changes"
                    (click)="$event.stopPropagation(); discard.emit(file)">
              <app-icon name="mdiTrashCanOutline"></app-icon>
            </button>
            <button type="button" class="button icon-button row-action" appTooltip="Stage"
                    (click)="$event.stopPropagation(); primary.emit([file.path])">
              <app-icon name="mdiPlus"></app-icon>
            </button>
          }
          @case ("staged") {
            <button type="button" class="button icon-button row-action" appTooltip="Unstage"
                    (click)="$event.stopPropagation(); primary.emit([file.path])">
              <app-icon name="mdiMinus"></app-icon>
            </button>
          }
          @case ("conflicted") {
            <button type="button" class="button icon-button row-action" appTooltip="Mark resolved"
                    (click)="$event.stopPropagation(); primary.emit([file.path])">
              <app-icon name="mdiCheck"></app-icon>
            </button>
          }
        }
      </div>
    </ng-template>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host { display: block; }
      .grow, .name { flex: 0 1 auto; }
      .grow { flex: 1 1 auto; }
      .dir { flex: 1 1 auto; font-size: var(--git-font-small); }
    `,
  ],
})
export class GitFileListComponent {
  readonly files = input.required<ReadonlyArray<GitFile>>();
  readonly kind = input.required<GitFileListKind>();
  readonly mode = input<GitFileListMode>("path");
  readonly selectedPath = input<string | null>(null);

  readonly open = output<GitFile>();
  /** Stage, unstage or mark resolved, depending on the list; a folder row emits its path. */
  readonly primary = output<string[]>();
  readonly discard = output<GitFile>();
  readonly menu = output<{ event: MouseEvent; file: GitFile }>();

  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly treeRows = computed(() => buildFileTree(this.files(), this.collapsed()));

  toggleFolder(path: string): void {
    this.collapsed.update((collapsed) => toggled(collapsed, path));
  }

  rowKey(row: GitFileTreeRow): string {
    return row.kind === "dir" ? `d:${row.path}` : `f:${row.file.path}`;
  }

  name(path: string): string {
    return fileName(path);
  }

  dir(path: string): string {
    return fileDir(path);
  }

  statusIcon = fileStatusIcon;
  statusClass = fileStatusClass;
}
