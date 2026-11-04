import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** Heads a group of tiles that belong to one workspace: its colour dot and name. */
@Component({
  selector: "app-workspace-group-header",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dot" [style.background-color]="'var(--color-' + color() + ')'"></span>
    <span class="name">{{ name() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
      font-size: 0.8rem;
      opacity: 0.75;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class WorkspaceGroupHeaderComponent {
  readonly name = input.required<string>();
  /** Colour name of the workspace. */
  readonly color = input.required<string>();
}
