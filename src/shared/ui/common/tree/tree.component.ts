import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Directive,
  Input,
  signal,
  TemplateRef,
} from "@angular/core";
import { IconComponent } from "../../icons/icon/icon.component";

/** What a row's template gets besides the node itself. */
export type TreeRowContext<T> = {
  readonly $implicit: T;
  /** Whether what is under the node is shown. */
  readonly open: boolean;
  /** Folds the node away or opens it: for a row that toggles on its name. */
  readonly toggle: () => void;
};

/** What a node's line shows, next to the arrow the tree draws. */
@Directive({ selector: "ng-template[appTreeRow]", standalone: true })
export class TreeRowDirective {}

/** What stands under a node's line and above its children, if anything. */
@Directive({ selector: "ng-template[appTreeDetail]", standalone: true })
export class TreeDetailDirective {}

/**
 * A tree whose branches fold away. The tree draws the arrow, sets children in
 * under their parent and remembers what is folded; what a line shows is the
 * caller's (`appTreeRow`), and so is what a node is: `childrenOf` and `keyOf`
 * read it.
 *
 * Inputs and queries are decorators, not signals: the component is rendered
 * in tests without the compiler that signal inputs need.
 *
 * It is a list that folds, not an ARIA tree: each line keeps its own buttons
 * in the tab order, and the arrow says whether its branch is open.
 *
 * Every branch is open at first. A node keeps its state by its key, so the
 * tree can be rebuilt from new data without folding or opening anything.
 */
@Component({
  selector: "app-tree",
  standalone: true,
  imports: [NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container
      *ngTemplateOutlet="branch; context: { $implicit: nodes, level: 0 }"
    ></ng-container>

    <ng-template #branch let-siblings let-level="level">
      <ul class="tree" [class.nested]="level > 0">
        @for (node of siblings; track keyOf(node)) {
          <li>
            <div class="tree-row">
              @if (hasChildren(node)) {
                <button
                  type="button"
                  class="tree-toggle"
                  [attr.aria-expanded]="isOpen(node)"
                  [attr.aria-label]="isOpen(node) ? 'Collapse' : 'Expand'"
                  (click)="toggle(node)"
                >
                  <app-icon [name]="isOpen(node) ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                </button>
              } @else {
                <span class="tree-toggle"></span>
              }
              <ng-container
                *ngTemplateOutlet="rowTemplate ?? null; context: contextOf(node)"
              ></ng-container>
            </div>
            @if (detailTemplate; as detail) {
              <div class="tree-detail">
                <ng-container
                  *ngTemplateOutlet="detail; context: contextOf(node)"
                ></ng-container>
              </div>
            }
            @if (hasChildren(node) && isOpen(node)) {
              <ng-container
                *ngTemplateOutlet="
                  branch;
                  context: { $implicit: childrenOf(node), level: level + 1 }
                "
              ></ng-container>
            }
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }

    .tree {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tree.nested {
      padding-left: 12px;
    }

    .tree-row {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 24px;
      border-radius: 4px;
    }

    .tree-row:hover {
      background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
    }

    .tree-toggle {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
      opacity: 0.7;
    }

    button.tree-toggle {
      cursor: pointer;
    }

    .tree-toggle app-icon {
      width: 16px;
      height: 16px;
    }

    /* Lines up with the row's text, past the arrow. */
    .tree-detail {
      padding-left: 20px;
    }

    .tree-detail:empty {
      display: none;
    }
  `,
})
export class TreeComponent<T> {
  /** The roots. */
  @Input({ required: true }) nodes: readonly T[] = [];
  @Input({ required: true }) childrenOf: (node: T) => readonly T[] = () => [];
  /** What tells a node from every other in the tree, whatever its level. */
  @Input({ required: true }) keyOf: (node: T) => string | number = String;
  /** Shows every branch whatever is folded, without forgetting it: for a filtered tree. */
  @Input() expandAll = false;

  @ContentChild(TreeRowDirective, { read: TemplateRef })
  protected rowTemplate?: TemplateRef<TreeRowContext<T>>;
  @ContentChild(TreeDetailDirective, { read: TemplateRef })
  protected detailTemplate?: TemplateRef<TreeRowContext<T>>;

  private readonly collapsed = signal<ReadonlySet<string | number>>(new Set());

  protected hasChildren(node: T): boolean {
    return this.childrenOf(node).length > 0;
  }

  protected isOpen(node: T): boolean {
    return this.expandAll || !this.collapsed().has(this.keyOf(node));
  }

  protected toggle(node: T): void {
    const key = this.keyOf(node);
    this.collapsed.update((collapsed) => {
      const next = new Set(collapsed);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected contextOf(node: T): TreeRowContext<T> {
    return {
      $implicit: node,
      open: this.isOpen(node),
      toggle: () => this.toggle(node),
    };
  }
}
