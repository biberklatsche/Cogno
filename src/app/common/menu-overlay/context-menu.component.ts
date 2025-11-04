import {Component, EventEmitter, Input, Output} from '@angular/core';
import { ContextMenuItem, ContextMenuOverlayComponent } from './menu-overlay.types';
import {ActionKeybindingPipe, KeybindingPipe} from "../keybinding/keybinding.pipe";

@Component({
    selector: 'app-context-menu',
    standalone: true,
    template: `
        <div class="ctx-menu" (contextmenu)="$event.preventDefault()" role="menu" tabindex="0">
            @for (item of items; track item; let i = $index) {
                @if (item.separator) {
                    <div class="sep" role="separator"></div>
                } @else {
                    <button
                            class="item"
                            type="button"
                            [disabled]="item.disabled"
                            (click)="onItemClick(item)"
                            role="menuitem">
                        <span>{{ item.label }}</span>
                        <span class="keybinding">{{ item.actionName | actionkeybinding }}</span>
                    </button>
                }
            }
        </div>
    `,
    imports: [
        ActionKeybindingPipe
    ],
    styles: [
        `
            :host {
                display: block;
            }

            .ctx-menu {
                background: var(--background-color-10l);
                color: var(--foreground-color);
                border: 1px solid var(--background-color-20l);
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
                border-radius: 6px;
                padding: 6px;
                min-width: 180px;
                max-width: 360px;
                user-select: none;
            }

            .item {
                display: flex;
                flex-direction: row;
                align-items: center;
                min-width: 100%;
                justify-content: space-between;
                padding: 8px 10px;
                background: transparent;
                color: inherit;
                border: none;
                border-radius: 4px;
                cursor: default;
                font-size: .9rem;
                
                .keybinding {
                    opacity: 0.5;
                }
            }

            .item:hover:enabled, .item:focus-visible:enabled {
                background: var(--background-color-20l);
                outline: none;
            }

            .item:disabled {
                opacity: 0.5;
                cursor: default;
            }

            .sep {
                height: 1px;
                background: var(--background-color-20l);
                margin: 6px 4px;
            }
        `
    ]
})
export class ContextMenuComponent implements ContextMenuOverlayComponent {
  @Input() items: ContextMenuItem[] = [];
  @Input() close?: () => void;

  @Output() itemSelected = new EventEmitter<ContextMenuItem>();

  onItemClick(item: ContextMenuItem) {
    if (item.disabled) return;
    try {
      item.action?.();
      this.itemSelected.emit(item);
    } finally {
      this.close?.();
    }
  }
}
