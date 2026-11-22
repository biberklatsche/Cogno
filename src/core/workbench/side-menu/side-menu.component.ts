import { NgComponentOutlet, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EffectRef,
  ElementRef,
  effect,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { ActionKeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/action-keybinding.pipe";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { SideMenuItem, SideMenuService } from "./+state/side-menu.service";

/**
 * Takes the keyboard to the panel, unless it is already inside: a click on a
 * field of a panel that did not have the keyboard focuses that field first,
 * and taking it to the panel afterwards would leave the field without it.
 */
export function focusPanel(panel: HTMLElement | undefined): void {
  if (!panel || panel.contains(document.activeElement)) return;
  panel.focus();
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
    "[class.expanded-host]": "hasExpanded()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
        @for (item of openItems(); track item.label) {
            <ng-container *ngTemplateOutlet="panel; context: { $implicit: item, floating: item.label === floatingItem()?.label }"></ng-container>
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
            <aside [attr.data-label]="item.label"
                   [class.base-overlay]="floating || expanded"
                   [class.pinned]="!floating && !expanded"
                   [class.floating]="floating"
                   [class.flat]="expanded"
                   [class.shift-left]="railItems().length > 0"
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
                        <button class="button icon-button" (click)="toggleExpanded(item.label)"
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
                <button class="button icon-button" (click)="open(menuItem)"
                        [class.selected]="isOpen(menuItem.label)" [appTooltip]="menuItem.label" [appTooltipSecondary]="menuItem.actionName | actionkeybinding">
                    <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                    @if (menuItem.badgeColor) {
                        <span class="badge" [style.background-color]="menuItem.badgeColor"></span>
                    }
                </button>
        </ng-template>`,
  styles: [
    `
        :host {
            display: flex;
            flex-direction: row;
            position: relative;
            min-height: 0;
        }

        /* An expanded panel is laid out against the whole workbench area,
           so the host must not be its containing block. */
        :host(.expanded-host) {
            position: static;
        }

        h3 {
            font-weight: normal;
            opacity: 0.7;
            padding-left: 0.5rem;
        }

        menu {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin: 2px 4px 4px 2px;
            padding: 0;
            z-index: 5;
            &.hidden {
                margin: 0;
            }

            .button.icon-button.selected {
                background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
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

        aside {
            /* Same vertical offsets in docked and overlay mode so toggling
               between the two does not shift the panel. */
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
            &.pinned {
                padding: 6px;
                color: var(--foreground-color);
                background-color: transparent;
                border-left: 2px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
            }

            /* The floating panel lies at the right edge, over the terminals
               and over the pinned panels. */
            &.floating,
            &.expanded {
                position: absolute;
                right: 4px;
                top: 0;
                bottom: 0;
                overflow: hidden;

                &.shift-left {
                    right: 32px;
                }
            }

            /* An expanded panel covers everything - the terminals and the
               other panels - so it is opaque. */
            &.expanded {
                background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
                left: 4px;
                z-index: 3;
            }

            /* After .expanded: a floating panel still lies over an expanded
               pinned one, it is the one just opened. */
            &.floating {
                z-index: 4;
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
  readonly railItems = this.menuItemService.railItems;
  readonly visibleItems = computed(() => this.railItems().filter((item) => !item.bottom));
  /** The workbench's own entries, below the features. */
  readonly bottomItems = computed(() => this.railItems().filter((item) => item.bottom));
  readonly dockedItems = this.menuItemService.dockedItems;
  readonly floatingItem = this.menuItemService.floatingItem;
  readonly focusedLabel = this.menuItemService.focusedLabel;
  /**
   * Every open panel in one list, the floating one last: pinning or unpinning
   * an open panel then only changes its place and look, and its content lives on.
   */
  readonly openItems = computed(() => {
    const floating = this.floatingItem();
    return floating ? [...this.dockedItems(), floating] : this.dockedItems();
  });
  /** An expanded panel is laid out against the whole workbench area. */
  readonly hasExpanded = computed(() => this.menuItemService.expandedLabel() !== undefined);

  @ViewChild("menuCol", { static: false }) menuColRef?: ElementRef<HTMLElement>;

  private clickOutsideEffect: EffectRef;
  private lastOpenTimestamp = 0;
  private resizeLabel?: string;
  private resizeStartPointerClientX = 0;
  private resizeStartPanelWidthInPixels = 0;

  constructor(
    private menuItemService: SideMenuService,
    private host: ElementRef<HTMLElement>,
  ) {
    // While a panel is open, every pointer press is told to the service: on
    // which panel it went down, or that it went down beside them all.
    this.clickOutsideEffect = effect(() => {
      if (this.openItems().length > 0) {
        this.lastOpenTimestamp = performance.now();
        document.addEventListener("pointerdown", this.onPointerDown, true);
      } else {
        document.removeEventListener("pointerdown", this.onPointerDown, true);
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
    window.removeEventListener("pointermove", this.onWindowPointerMove, true);
    window.removeEventListener("pointerup", this.onWindowPointerUp, true);
    this.clickOutsideEffect.destroy();
  }

  private onPointerDown = (ev: PointerEvent) => {
    // Ignore the very event that triggered open
    if (Math.abs(ev.timeStamp - this.lastOpenTimestamp) < 10) return;

    const target = ev.target as Node;
    const targetElement = target instanceof Element ? target : null;
    // Dialogs and context menus a panel opens live outside the panel's DOM.
    const clickedInsidePanelOverlay = !!targetElement?.closest("app-dialog, .menu-overlay-host");
    if (clickedInsidePanelOverlay) return;
    if (this.menuColRef?.nativeElement.contains(target)) return;

    const clickedPanel = targetElement?.closest<HTMLElement>("aside[data-label]") ?? null;
    const clickedLabel =
      clickedPanel && this.host.nativeElement.contains(clickedPanel)
        ? clickedPanel.dataset["label"]
        : undefined;

    this.menuItemService.pointerDown(clickedLabel);
  };

  /** A click on an open panel's icon closes it, as the X does. */
  open(menuItem: SideMenuItem) {
    if (this.isOpen(menuItem.label)) {
      this.close(menuItem.label);
      return;
    }
    this.menuItemService.open(menuItem.label);
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

  toggleExpanded(label: string) {
    this.menuItemService.toggleExpanded(label);
  }

  startResize(pointerEvent: PointerEvent, label: string): void {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    this.resizeLabel = label;
    this.resizeStartPointerClientX = pointerEvent.clientX;
    this.resizeStartPanelWidthInPixels = this.panelWidthInPixels(label);
    window.addEventListener("pointermove", this.onWindowPointerMove, true);
    window.addEventListener("pointerup", this.onWindowPointerUp, true);
  }

  private onWindowPointerMove = (pointerEvent: PointerEvent): void => {
    if (this.resizeLabel === undefined) return;
    const horizontalDeltaInPixels = this.resizeStartPointerClientX - pointerEvent.clientX;
    this.menuItemService.setPanelWidthInPixels(
      this.resizeLabel,
      this.resizeStartPanelWidthInPixels + horizontalDeltaInPixels,
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
