import {Component, EventEmitter, Input, Output} from '@angular/core';

export type ContextMenuItem = {
  label?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
};

@Component({
  selector: 'app-simple-context-menu',
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
            {{ item.label }}
          </button>
        }
      }
    </div>
  `,
  styles: [
    `
    :host { display: block; }
    .ctx-menu {
      background: #1f1f1f;
      color: #eaeaea;
      border: 1px solid #3a3a3a;
      box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      border-radius: 6px;
      padding: 6px;
      min-width: 180px;
      max-width: 360px;
      user-select: none;
      font-size: 13px;
    }
    .item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      background: transparent;
      color: inherit;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .item:hover:enabled, .item:focus-visible:enabled {
      background: #2b2b2b;
      outline: none;
    }
    .item:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .sep { height: 1px; background: #2a2a2a; margin: 6px 4px; }
    `
  ]
})
export class SimpleContextMenuComponent {
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
