import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * The tiles of one workspace in a side panel, under its colour dot and name.
 * The name sits closer to its own tiles than to the group above, so it reads
 * as theirs, and stays on top while they scroll by. Every panel that groups
 * tiles by workspace uses this, so the spacing lives in one place.
 */
@Component({
  selector: "app-workspace-group",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (name()) {
      <header class="header">
        <span class="dot" [style.background-color]="'var(--color-' + color() + ')'"></span>
        <span class="name">{{ name() }}</span>
      </header>
    }
    <ng-content></ng-content>
  `,
  styles: `
    :host {
      display: flex;
      flex-flow: row wrap;
      align-content: flex-start;
      gap: 0.5rem;
      padding-top: 1rem;
    }

    :host(:first-child) {
      padding-top: 0.25rem;
    }

    /* Takes a whole row; the group's gap is all that separates it from its tiles. */
    .header {
      flex-basis: 100%;
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
      padding-top: 0.25rem;
      font-size: 0.8rem;
      /* The side menu's own surface, so the header looks like part of the list. */
      background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
      opacity: 0.75;
    }

    .name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.75;
    }
  `,
})
export class WorkspaceGroupComponent {
  /** Name of the workspace; without one the tiles stand alone. */
  readonly name = input<string>();
  /** Colour name of the workspace. */
  readonly color = input<string>("");
}
