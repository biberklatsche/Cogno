import { NgTemplateOutlet } from "@angular/common";
import { Component, Input, TemplateRef } from "@angular/core";
import { ContextMenuItem, ContextMenuOverlayComponent } from "@cogno/core-api";
import { ToggleSwitchComponent } from "../../common/toggle-switch/toggle-switch.component";
import { IconComponent } from "../../icons/icon/icon.component";

@Component({
  selector: "app-context-menu",
  standalone: true,
  imports: [NgTemplateOutlet, IconComponent, ToggleSwitchComponent],
  template: `
        <div class="ctx-menu base-overlay" (contextmenu)="$event.preventDefault()" role="menu" tabindex="0">
            @for (item of items; track item; let i = $index) {
                @if (item.separator) {
                    <div class="sep"></div>
                } @else if (item.custom) {
                    <div class="embed">
                        <ng-container [ngTemplateOutlet]="customItemTemplate ?? null" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container>
                    </div>
                } @else if (item.header) {
                    <div class="header">
                        {{item.label}}
                    </div>
                } @else if (item.toggle) {
                    <button
                            class="item toggle-item"
                            type="button"
                            [disabled]="item.disabled"
                            (click)="onItemClick(item)"
                            role="menuitemcheckbox"
                            [attr.aria-checked]="item.toggled ?? false">
                        <span class="label">{{ item.label }}</span>
                        <span class="toggle-meta">
                            <span class="toggle-state">{{ item.toggled ? 'On' : 'Off' }}</span>
                            <app-toggle-switch [checked]="item.toggled ?? false"></app-toggle-switch>
                        </span>
                    </button>
                } @else {
                    <button
                            class="item"
                            type="button"
                            [disabled]="item.disabled"
                            (click)="onItemClick(item)"
                            role="menuitem"
                            [attr.aria-checked]="item.checked">
                        <span class="label" [style.color]="item.color">{{ item.label }}</span>
                        @if (item.keybinding) {
                            <span class="keybinding">{{ item.keybinding }}</span>
                        }
                        @if (item.checked !== undefined) {
                            <span class="check" aria-hidden="true">
                                @if (item.checked) {
                                    <app-icon name="mdiCheck"></app-icon>
                                }
                            </span>
                        }
                    </button>
                }
            }
        </div>
    `,
  styles: [
    `
            :host {
                display: block;
            }

            .ctx-menu {
                min-width: 180px;
                max-width: 360px;
                box-sizing: border-box;
                user-select: none;
                transform-origin: top center;
                animation: ctx-menu-in 100ms ease-out;
            }

            @keyframes ctx-menu-in {
                from {
                    opacity: 0;
                    transform: translateY(-4px) scale(0.98);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .item {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 1rem;
                width: 100%;
                max-width: 100%;
                justify-content: space-between;
                box-sizing: border-box;
                padding: 8px 10px;
                background: transparent;
                color: inherit;
                border: none;
                border-radius: 4px;
                cursor: default;
                font-size: .9rem;

                .keybinding {
                    flex: 0 0 auto;
                    opacity: 0.5;
                }

                .check {
                    flex: 0 0 auto;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 1rem;
                    height: 1rem;
                    opacity: 0.8;
                }
            }

            .toggle-item .toggle-meta {
                display: inline-flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 8px;
            }

            .toggle-item .toggle-state {
                opacity: 0.55;
                font-size: .8rem;
                min-width: 1.5rem;
                text-align: right;
            }

            .item:hover:enabled, .item:focus-visible:enabled {
                background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
                outline: none;
            }

            .item:disabled {
                opacity: 0.5;
                cursor: default;
            }

            .header {
                margin: 4px;
                opacity: 0.5;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .label {
                flex: 1 1 auto;
                min-width: 0;
                text-align: left;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .sep {
                height: 1px;
                background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
                margin: 6px 4px;
            }

            .embed {
                padding: 4px;
            }
        `,
  ],
})
export class ContextMenuComponent implements ContextMenuOverlayComponent {
  @Input() items: ContextMenuItem[] = [];
  @Input() close?: () => void;
  @Input() customItemTemplate?: TemplateRef<{ $implicit: ContextMenuItem }>;

  onItemClick(item: ContextMenuItem) {
    if (item.disabled) return;
    try {
      item.action?.(item);
    } finally {
      if (item.closeOnSelect !== false) {
        this.close?.();
      }
    }
  }
}
