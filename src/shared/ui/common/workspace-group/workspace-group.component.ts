import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  input,
  OnDestroy,
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
    <span class="rest-mark" aria-hidden="true"></span>
    @if (name()) {
      <header
        class="header"
        [class.stuck]="stuck()"
        [style.--workspace-color]="color() ? 'var(--color-' + color() + ')' : null"
      >
        <span class="dot"></span>
        <span class="name">{{ name() }}</span>
      </header>
    }
    <ng-content></ng-content>
  `,
  styles: `
    :host {
      --group-padding-top: 1rem;
      position: relative;
      display: flex;
      flex-flow: row wrap;
      align-content: flex-start;
      gap: 0.5rem;
      padding-top: var(--group-padding-top);
    }

    :host(:first-child) {
      --group-padding-top: 0.25rem;
    }

    /* Marks where the name rests, right below the group's padding. Out of the
       flow, so it adds no row and no gap to the tiles. */
    .rest-mark {
      position: absolute;
      top: var(--group-padding-top);
      left: 0;
      width: 100%;
      height: 1px;
      pointer-events: none;
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
        backdrop-filter 120ms ease-out,
        -webkit-backdrop-filter 120ms ease-out;
    }

    /* A group without a colour still gets a surface, in the text colour. */
    .header.stuck {
      background-color: color-mix(
        in srgb,
        var(--workspace-color, var(--foreground-color)) var(--menu-opacity-ct2),
        transparent
      );
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
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
export class WorkspaceGroupComponent implements AfterViewInit, OnDestroy {
  /** Name of the workspace; without one the tiles stand alone. */
  readonly name = input<string>();
  /** Colour name of the workspace. */
  readonly color = input<string>("");

  /** Whether the name is held at the top while its tiles scroll beneath it. */
  readonly stuck = signal(false);

  /**
   * Watches the mark of the name's resting place. The name can only start or
   * stop sticking when that mark crosses the edge of what the panel shows -
   * by a scroll, or by the layout moving the group without one.
   */
  private restMarkObserver?: IntersectionObserver;

  constructor(@Inject(ElementRef) private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const restMark = this.host.nativeElement.querySelector<HTMLElement>(":scope > .rest-mark");
    if (!restMark) return;
    // No root: the intersection is clipped by the panel's scroll container
    // without the group having to know it.
    this.restMarkObserver = new IntersectionObserver((entries) => {
      const latest = entries.at(-1);
      if (latest) this.updateStuck(restMark, latest.isIntersecting);
    });
    this.restMarkObserver.observe(restMark);
  }

  ngOnDestroy(): void {
    this.restMarkObserver?.disconnect();
  }

  /**
   * The name sticks while its resting place is out of view above it. A resting
   * place out of view below takes the name along, so the two stay together.
   */
  private updateStuck(restMark: HTMLElement, restMarkInView: boolean): void {
    const header = this.host.nativeElement.querySelector<HTMLElement>(":scope > .header");
    if (restMarkInView || !header) {
      this.stuck.set(false);
      return;
    }
    const pushedBy = header.getBoundingClientRect().top - restMark.getBoundingClientRect().top;
    this.stuck.set(pushedBy > 0.5);
  }
}
