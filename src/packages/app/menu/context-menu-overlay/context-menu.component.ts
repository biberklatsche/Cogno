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
                            <span class="toggle-switch" [class.on]="item.toggled"></span>
                        </span>
                    </button>
                } @else {
                    <button
                            class="item"
                            type="button"
                            [disabled]="item.disabled"
                            (click)="onItemClick(item)"
                            role="menuitem">
                        <span class="label">{{ item.label }}</span>
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
                box-sizing: border-box;
                user-select: none;
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
            }

            .toggle-item {
                .toggle-meta {
                    display: inline-flex;
                    flex: 0 0 auto;
                    align-items: center;
                    gap: 8px;
                }

                .toggle-state {
                    opacity: 0.55;
                    font-size: .8rem;
                    min-width: 1.5rem;
                    text-align: right;
                }

                .toggle-switch {
                    width: 1.8rem;
                    height: 1rem;
                    border-radius: 999px;
                    background: var(--background-color-20l);
                    border: 1px solid var(--background-color-40l);
                    position: relative;
                    transition: background-color .12s ease;

                    &::after {
                        content: "";
                        position: absolute;
                        left: 2px;
                        top: 50%;
                        width: 0.74rem;
                        height: 0.74rem;
                        border-radius: 50%;
                        transform: translateY(-50%);
                        background: var(--foreground-color);
                        transition: left .12s ease;
                    }

                    &.on {
                        background: var(--highlight-color);
                    }

                    &.on::after {
                        left: calc(100% - 0.74rem - 2px);
                    }
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
                text-transform: capitalize;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            
            .label {
                flex: 1 1 auto;
                min-width: 0;
                text-transform: capitalize;
                text-align: left;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
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
      item.action?.(item);
    } finally {
      if (item.closeOnSelect !== false) {
        this.close?.();
      }
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


