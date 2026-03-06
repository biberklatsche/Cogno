import {Component, Input} from '@angular/core';
import { ContextMenuItem, ContextMenuOverlayComponent } from './context-menu-overlay.types';

import {ColorSelectComponent} from "../../common/color/color-select.component";
import {ActionKeybindingPipe} from "../../keybinding/pipe/keybinding.pipe";
import {ColorName} from "../../common/color/color";

@Component({
    selector: 'app-context-menu',
    standalone: true,
    template: `
        <div class="ctx-menu base-overlay" (contextmenu)="$event.preventDefault()" role="menu" tabindex="0">
            @for (item of items; track item; let i = $index) {
                @if (item.separator) {
                    <div class="sep"></div>
                } @else if (item.colorpicker) {
                    <div class="embed">
                        <app-color-select (colorSelected)="onColorPick(item, $event)" [selectedColorName]="item.selectedColorName"></app-color-select>
                    </div>
                }@else if (item.header) {
                    <div class="header">
                        {{item.label}}
                    </div>
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
    ActionKeybindingPipe,
    ColorSelectComponent
],
    styles: [
        `
            :host {
                display: block;
            }

            .ctx-menu {
                min-width: 180px;
                max-width: 360px;
                user-select: none;
            }

            .item {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 1rem;
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

            .header {
                margin: 4px;
                opacity: 0.5;
            }
            
            .sep {
                height: 1px;
                background: var(--background-color-20l);
                margin: 6px 4px;
            }
            
            .embed {
                padding: 4px;
            }
        `
    ]
})
export class ContextMenuComponent implements ContextMenuOverlayComponent {
  @Input() items: ContextMenuItem[] = [];
  @Input() close?: () => void;

  onItemClick(item: ContextMenuItem) {
    if (item.disabled) return;
    try {
      item.action?.();
    } finally {
      this.close?.();
    }
  }

  onColorPick(item: ContextMenuItem, name: ColorName) {
    try {
      item.action?.(name);
    } finally {
      this.close?.();
    }
  }
}
