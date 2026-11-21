import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";

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
      <header
        class="header"
        [class.stuck]="stuck()"
        [style.--workspace-color]="'var(--color-' + color() + ')'"
      >
        <span class="dot"></span>
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

    /* Takes a whole row; the group's gap is all that separates it from its tiles.
       At rest it has no surface: a pinned panel is transparent and a floating
       one translucent, so any fill would show as a band. Only while it sticks
       and tiles pass beneath it does it take a frosted surface in the
       workspace's colour, mixed as the workspace list marks the active one.
       The inset is there at rest too, so the name does not move when the
       surface appears; the negative margin keeps the gap to its tiles. */
    .header {
      flex-basis: 100%;
      box-sizing: border-box;
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
      padding: 0.25rem 0.5rem;
      margin-bottom: -0.25rem;
      border-radius: var(--button-border-radius);
      font-size: 0.8rem;
      background-color: transparent;
      transition:
        background-color 120ms ease-out,
        backdrop-filter 120ms ease-out;
    }

    .header.stuck {
      background-color: color-mix(in srgb, var(--workspace-color) var(--menu-opacity-ct2), transparent);
      backdrop-filter: blur(5px);
    }

    @media (prefers-reduced-motion: reduce) {
      .header {
        transition: none;
      }
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
      opacity: 0.75;
      background-color: var(--workspace-color);
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
export class WorkspaceGroupComponent implements OnInit, OnDestroy {
  /** Name of the workspace; without one the tiles stand alone. */
  readonly name = input<string>();
  /** Colour name of the workspace. */
  readonly color = input<string>("");

  /** Whether the name is held at the top while its tiles scroll beneath it. */
  readonly stuck = signal(false);

  /** Only a scroll of a container holding the group can move it; terminals scroll a lot. */
  private readonly onScroll = (event: Event): void => {
    if (event.target instanceof Node && event.target.contains(this.host.nativeElement)) {
      this.updateStuck();
    }
  };

  constructor(@Inject(ElementRef) private readonly host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    // Scroll events do not bubble; capturing on the document catches the
    // panel's scroll container without the group having to know it.
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
  }

  ngOnDestroy(): void {
    document.removeEventListener("scroll", this.onScroll, { capture: true });
  }

  /**
   * A header that sticks has been pushed down inside its group: it sits further
   * from the group's top than where it rests, right below the group's padding.
   */
  private updateStuck(): void {
    const group = this.host.nativeElement;
    const header = group.querySelector<HTMLElement>(":scope > .header");
    if (!header) return;
    const pushedBy =
      header.getBoundingClientRect().top -
      group.getBoundingClientRect().top -
      Number.parseFloat(getComputedStyle(group).paddingTop);
    this.stuck.set(pushedBy > 0.5);
  }
}
