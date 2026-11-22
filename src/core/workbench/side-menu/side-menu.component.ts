import { NgComponentOutlet, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EffectRef,
  ElementRef,
  effect,
  input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { ActionKeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/action-keybinding.pipe";
import { IconComponent, SIDE_MENU_SEARCH_INPUT_SELECTOR, TooltipDirective } from "@cogno/shared/ui";
import { SideMenuItem, SideMenuService } from "./+state/side-menu.service";

/**
 * Takes the keyboard to the panel: to its search field when it has one, with
 * the text selected so typing replaces it, and to the panel itself otherwise.
 * Not when the keyboard is already inside: a click on a field of a panel that
 * did not have the keyboard focuses that field first, and taking it elsewhere
 * afterwards would leave the field without it.
 */
export function focusPanel(panel: HTMLElement | undefined): void {
  if (!panel || panel.contains(document.activeElement)) return;
  const searchField = panel.querySelector<HTMLInputElement>(SIDE_MENU_SEARCH_INPUT_SELECTOR);
  if (!searchField) {
    panel.focus();
    return;
  }
  searchField.focus();
  searchField.select();
}

/** The width set on a panel, without its padding and border: what `style.width` means. */
function contentWidth(panel: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(panel).width);
}

/**
 * The width a panel gets while its edge is dragged: it follows the pointer,
 * but grows no further than the room the terminals have left above their floor.
 */
export function resizedPanelWidth(startWidth: number, draggedBy: number, room: number): number {
  return Math.min(startWidth + draggedBy, startWidth + Math.max(0, room));
}

@Component({
  selector: "app-side-menu",
  imports: [
    IconComponent,
    NgComponentOutlet,
    NgTemplateOutlet,
    TooltipDirective,
    ActionKeybindingPipe,
  ],
  host: {
    "[style.--panel-min-width.px]": "minimumPanelWidthInPixels",
    "[style.--panels-in-row]": "panelsInRow()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        @for (item of openItems(); track item.label) {
            <ng-container *ngTemplateOutlet="panel; context: { $implicit: item, floating: item.label === floatingLabel() }"></ng-container>
        }
        <menu #menuCol [class.hidden]="railItems().length === 0">
            @for (menuItem of visibleItems(); track menuItem.id ?? menuItem.label) {
                <ng-container *ngTemplateOutlet="menuButton; context: { $implicit: menuItem }"></ng-container>
            }
            <span class="menu-spacer"></span>
            @for (menuItem of bottomItems(); track menuItem.id ?? menuItem.label) {
                <ng-container *ngTemplateOutlet="menuButton; context: { $implicit: menuItem }"></ng-container>
            }
        </menu>
        <ng-template #panel let-item let-floating="floating">
            @let expanded = isExpanded(item.label);
            @let inRow = !floating && !expanded;
            @if (expanded && !floating) {
                <div class="row-slot" [style.width.px]="panelWidthInPixels(item.label)"></div>
            }
            <aside [attr.data-label]="item.label"
                   [class.base-overlay]="!inRow"
                   [class.in-row]="inRow"
                   [class.floating]="floating"
                   [class.without-keyboard]="!floating && focusedLabel() !== item.label"
                   [class.expanded]="expanded"
                   [style.width.px]="expanded ? null : panelWidthInPixels(item.label)"
                   tabindex="-1"
            >
                @if (!expanded) {
                    <div class="resize-handle" (pointerdown)="startResize($event, item.label)"></div>
                }
                <header>
                    <h3>{{ item.label }}</h3>
                    <div class="btn-list">
                        <button class="button icon-button" (click)="toggleExpanding(item.label)"
                                [appTooltip]="expanded ? 'Restore panel width' : 'Expand panel over the terminals'">
                            <app-icon [name]="expanded ? 'mdiArrowCollapseHorizontal' : 'mdiArrowExpandHorizontal'"></app-icon>
                        </button>
                        <button class="button icon-button" (click)="togglePin(item.label)"
                                [appTooltip]="isPinned(item.label) ? 'Unpin panel' : 'Pin panel beside the terminals'">
                            <app-icon [name]="isPinned(item.label) ? 'mdiPin': 'mdiPinOff'"></app-icon>
                        </button>
                        <button class="button icon-button" (click)="close(item.label)" appTooltip="Close">
                            <app-icon [name]="'mdiClose'"></app-icon>
                        </button>
                    </div>
                </header>
                <main>
                    @if (item.component) {
                        <ng-container *ngComponentOutlet="item.component"></ng-container>
                    }
                </main>
            </aside>
        </ng-template>
        <ng-template #menuButton let-menuItem>
                <button class="button icon-button" (click)="toggle(menuItem)"
                        [class.selected]="floatingLabel() === menuItem.label"
                        [class.standing]="isPinned(menuItem.label) && isOpen(menuItem.label)"
                        [class.keyboard]="focusedLabel() === menuItem.label"
                        [appTooltip]="isPinned(menuItem.label) ? menuItem.label + ' (pinned)' : menuItem.label"
                        [appTooltipSecondary]="menuItem.actionName | actionkeybinding">
                    <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                    @if (menuItem.badgeColor) {
                        <span class="badge" [style.background-color]="menuItem.badgeColor"></span>
                    }
                </button>
        </ng-template>`,
  styles: [
    `
        /* The host has no box: the panels and the rail are items of the row
           they share with the terminals (grid-list.component), and the
           floating and the expanded panel are laid out against that row. */
        :host {
            display: contents;
            /* The rail's button and its margins; what a pinned panel adds to its width. */
            --rail-width: 32px;
            --panel-padding: 6px;
            --panel-divider: 2px;
        }

        h3 {
            font-weight: normal;
            opacity: 0.7;
            padding-left: 0.5rem;
        }

        menu {
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            gap: 4px;
            margin: 2px 4px 4px 2px;
            padding: 0;
            z-index: 5;
            &.hidden {
                margin: 0;
            }

            /* The floating panel's entry is a filled button: it is open like a
               dialog and its entry closes it. */
            .button.icon-button.selected {
                background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
            }

            /* The entry of the panel that has the keyboard is the bright one,
               whichever kind of panel it is. */
            .button.icon-button.keyboard {
                color: var(--foreground-color);
            }

            /* An open pinned panel's entry has a bar on the side where the
               panel stands: it belongs to the layout, and its entry only
               takes the keyboard there. Quiet while the panel just stands
               there, in the highlight colour while it has the keyboard. A
               closed panel's entry is unmarked, pinned or not. */
            .button.icon-button.standing::before {
                content: "";
                position: absolute;
                left: -2px;
                top: 3px;
                bottom: 3px;
                width: 2px;
                border-radius: 2px;
                background: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
                transition: background-color 120ms ease-out;
            }

            .button.icon-button.standing.keyboard::before {
                background: var(--highlight-color);
            }

            @media (prefers-reduced-motion: reduce) {
                .button.icon-button.standing::before {
                    transition: none;
                }
            }

            .button {
                position: relative;
            }

            .menu-spacer {
                flex: 1 1 auto;
            }

            .badge {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                border: 1px solid var(--background-color);
            }
        }

        /* What stands in the row with the terminals: a pinned panel, and the
           place an expanded pinned panel keeps while it spans everything, so
           the terminals do not change their width - and are not resized -
           each time it takes or gives back the keyboard.
           When the row is too narrow for the terminals' floor, these get
           narrower, each in proportion to its width, down to the minimum; the
           width they are set to stays. */
        aside.in-row,
        .row-slot {
            /* Shrinks long before the terminals do (grid-list.component). */
            flex: 0 100000 auto;
            /* The minimum - unless the row cannot even hold every panel at
               its minimum: then they share what is there, so nothing is
               pushed out of the window. The terminals have no width then;
               it takes closing a panel to get them back. */
            min-width: min(
                var(--panel-min-width),
                calc((100% - var(--rail-width)) / var(--panels-in-row) - 2 * var(--panel-padding) - var(--panel-divider))
            );
            padding: var(--panel-padding);
            border-left: var(--panel-divider) solid transparent;
        }

        aside {
            /* Same vertical offsets pinned and floating, so changing between
               the two does not shift the panel. */
            margin-top: 2px;
            margin-bottom: 4px;
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            max-height: 100%;
            min-width: 0;

            /* Slide in from the right on open. */
            translate: 0 0;
            opacity: 1;
            transition:
                translate 120ms ease-out,
                opacity 120ms ease-out;

            @starting-style {
                translate: 24px 0;
                opacity: 0;
            }

            /* A pinned panel is no overlay but one more pane of the tab: no
               surface of its own, so it shows what the terminals show - the
               background colour, or the background image - and the divider
               between panes towards the terminals. That it stays is visible
               at once. Pinned panels stand side by side. Its offsets are the
               aside's, so pinning does not move it. */
            &.in-row {
                color: var(--foreground-color);
                background-color: transparent;
                border-left-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
            }

            /* The floating panel lies at the right edge, over the terminals
               and over the pinned panels. */
            &.floating,
            &.expanded {
                position: absolute;
                /* Beside the rail: a panel is only open while its entry is there. */
                right: var(--rail-width);
                top: 0;
                bottom: 0;
                z-index: 3;
                overflow: hidden;
            }

            /* An expanded panel covers everything - the terminals and the
               other panels - so it is opaque and casts no shadow. */
            &.expanded {
                background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
                box-shadow: none;
                left: 4px;
            }

            .resize-handle {
                position: absolute;
                top: 0;
                bottom: 0;
                left: -4px;
                width: 8px;
                cursor: ew-resize;
                z-index: 2;
            }

            header {
                display: flex;
                flex-direction: row;
                gap: 1rem;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 1;

                h3 {
                    flex: 1 1 auto;
                    min-width: 0;
                }

                .btn-list {
                    display: flex;
                    flex-direction: row;
                    gap: 2px;
                    margin-left: auto;
                }
            }
            
            main {
                padding: 0.5rem;
                flex: 1 1 auto;
                overflow: hidden;
                min-height: 0;
            }

            main > * {
                min-height: 0;
                max-height: 100%;
            }

            main :where(ul) {
                overflow: auto;
                max-height: 100%;
                min-height: 0;
            }
        }
    `,
  ],
})
export class SideMenuComponent implements OnDestroy {
  /** How much wider the panels can get before the terminals reach their floor. */
  readonly roomBesideTerminals = input<() => number>(() => Number.POSITIVE_INFINITY);
  protected readonly minimumPanelWidthInPixels = SideMenuService.minimumPanelWidthInPixels;

  readonly railItems = this.menuItemService.railItems;
  readonly visibleItems = computed(() => this.railItems().filter((item) => !item.bottom));
  /** The workbench's own entries, below the features. */
  readonly bottomItems = computed(() => this.railItems().filter((item) => item.bottom));
  readonly floatingLabel = this.menuItemService.floatingLabel;
  readonly focusedLabel = this.menuItemService.focusedLabel;
  readonly openItems = this.menuItemService.openItems;
  /** The pinned panels, each standing in the row with the terminals or keeping its place there. */
  protected readonly panelsInRow = computed(() => {
    const floating = this.floatingLabel();
    return this.openItems().filter((item) => item.label !== floating).length;
  });
  /** Flips only when the first panel opens or the last one closes, whatever else changes. */
  private readonly anyPanelOpen = computed(() => this.openItems().length > 0);

  @ViewChild("menuCol", { static: false }) menuColRef?: ElementRef<HTMLElement>;

  private clickOutsideEffect: EffectRef;
  private lastOpenTimestamp = 0;
  private resizeLabel?: string;
  private resizeStartPointerClientX = 0;
  private resizeStartPanelWidthInPixels = 0;
  private resizeRoomInPixels = 0;

  constructor(
    private menuItemService: SideMenuService,
    private host: ElementRef<HTMLElement>,
  ) {
    // While a panel is open, the service is told on which panel a pointer
    // press went down or where the keyboard went, or that it was beside them all.
    this.clickOutsideEffect = effect(() => {
      if (this.anyPanelOpen()) {
        this.lastOpenTimestamp = performance.now();
        document.addEventListener("pointerdown", this.onPointerDown, true);
        document.addEventListener("focusin", this.onFocusIn, true);
      } else {
        document.removeEventListener("pointerdown", this.onPointerDown, true);
        document.removeEventListener("focusin", this.onFocusIn, true);
      }
    });

    effect(() => {
      const label = this.focusedLabel();
      if (label === undefined) return;
      queueMicrotask(() => focusPanel(this.panelElement(label)));
    });
  }

  ngOnDestroy() {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("focusin", this.onFocusIn, true);
    window.removeEventListener("pointermove", this.onWindowPointerMove, true);
    window.removeEventListener("pointerup", this.onWindowPointerUp, true);
    this.clickOutsideEffect.destroy();
  }

  private onPointerDown = (ev: PointerEvent) => {
    // Ignore the very event that triggered open
    if (Math.abs(ev.timeStamp - this.lastOpenTimestamp) < 10) return;

    if (this.belongsToThePanels(ev.target)) return;
    this.menuItemService.pointerDown(this.panelLabelOf(ev.target));
  };

  /**
   * The keyboard can leave a panel without a pointer press: a shortcut gives
   * it to a terminal, Tab takes it to the next panel. The panel that had it
   * must not go on believing it has - its Escape would be taken from the terminal.
   */
  private onFocusIn = (ev: FocusEvent) => {
    if (this.belongsToThePanels(ev.target)) return;
    const label = this.panelLabelOf(ev.target);
    if (label !== this.focusedLabel()) this.menuItemService.keyboardMovedTo(label);
  };

  /** The rail, and the dialogs and context menus a panel opens outside its own DOM. */
  private belongsToThePanels(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    if (this.menuColRef?.nativeElement.contains(target)) return true;
    return target instanceof Element && !!target.closest("app-dialog, .menu-overlay-host");
  }

  /** The panel the element lies in, if any. */
  private panelLabelOf(target: EventTarget | null): string | undefined {
    const panel =
      target instanceof Element ? target.closest<HTMLElement>("aside[data-label]") : null;
    return panel && this.host.nativeElement.contains(panel) ? panel.dataset["label"] : undefined;
  }

  /** A click on a panel's icon does what its shortcut does. */
  toggle(menuItem: SideMenuItem) {
    this.menuItemService.toggle(menuItem.label);
  }

  isOpen(label: string): boolean {
    return this.menuItemService.isOpen(label);
  }

  isPinned(label: string): boolean {
    return this.menuItemService.isPinned(label);
  }

  isExpanded(label: string): boolean {
    return this.menuItemService.isExpanded(label);
  }

  panelWidthInPixels(label: string): number {
    return this.menuItemService.panelWidthInPixels(label);
  }

  close(label: string) {
    this.menuItemService.close(label);
  }

  togglePin(label: string) {
    this.menuItemService.togglePin(label);
  }

  toggleExpanding(label: string) {
    this.menuItemService.toggleExpanding(label);
  }

  startResize(pointerEvent: PointerEvent, label: string): void {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    this.resizeLabel = label;
    this.resizeStartPointerClientX = pointerEvent.clientX;
    // From the width it shows, which is less than the width it is set to while
    // the row is too narrow.
    const panel = (pointerEvent.currentTarget as HTMLElement).parentElement;
    this.resizeStartPanelWidthInPixels = panel
      ? contentWidth(panel)
      : this.panelWidthInPixels(label);
    // The floating panel lies over the terminals and takes no room from them.
    this.resizeRoomInPixels =
      this.floatingLabel() === label ? Number.POSITIVE_INFINITY : this.roomBesideTerminals()();
    window.addEventListener("pointermove", this.onWindowPointerMove, true);
    window.addEventListener("pointerup", this.onWindowPointerUp, true);
  }

  private onWindowPointerMove = (pointerEvent: PointerEvent): void => {
    if (this.resizeLabel === undefined) return;
    const horizontalDeltaInPixels = this.resizeStartPointerClientX - pointerEvent.clientX;
    this.menuItemService.setPanelWidthInPixels(
      this.resizeLabel,
      resizedPanelWidth(
        this.resizeStartPanelWidthInPixels,
        horizontalDeltaInPixels,
        this.resizeRoomInPixels,
      ),
    );
  };

  private onWindowPointerUp = (): void => {
    this.resizeLabel = undefined;
    window.removeEventListener("pointermove", this.onWindowPointerMove, true);
    window.removeEventListener("pointerup", this.onWindowPointerUp, true);
  };

  private panelElement(label: string): HTMLElement | undefined {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>("aside[data-label]")].find(
      (panel) => panel.dataset["label"] === label,
    );
  }
}
