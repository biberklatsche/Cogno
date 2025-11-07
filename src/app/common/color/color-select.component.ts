import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {map, Observable} from 'rxjs';
import {ConfigService} from '../../config/+state/config.service';
import {Color as ColorUtil} from './color';
import { ColorName } from '../menu-overlay/menu-overlay.types';

interface ColorItem {
  name: ColorName;
  value: string; // hex with leading '#'
  text: string;  // text color for contrast
}

@Component({
  selector: 'app-color-select',
  standalone: true,
  imports: [CommonModule],
  template: `
      @if (colors$ | async; as colors) {
          <div class="color-grid">
              @for (c of colors; track c.name) {
                  <button
                          type="button"
                          class="color-btn"
                          [style.background]="c.value"
                          [style.color]="c.text"
                          (click)="onPick(c.name)"
                          [attr.aria-label]="c.name"
                          [title]="c.name"
                  >
                      {{ c.name }}
                  </button>
              }
          </div>
      }
  `,
  styles: [
    `
    :host { display: block; }
    .color-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: 2.5rem;
      gap: .5rem;
    }
    .color-btn {
      width: 100%;
      height: 100%;
      border: 1px solid var(--color-shadow2, rgba(0,0,0,.2));
      border-radius: .375rem;
      box-shadow: var(--shadow1, none);
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      text-transform: lowercase;
    }
    .color-btn:focus-visible { outline: 2px solid var(--highlight-color, #888); outline-offset: 2px; }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorSelectComponent {
  @Output() colorSelected = new EventEmitter<ColorName>();

  constructor(private readonly config: ConfigService) {}

  readonly colors$: Observable<ColorItem[]> = this.config.config$.pipe(
    map(cfg => {
      const color = cfg.color ?? {} as any;
      const items: { name: ColorName; hex?: string }[] = [
        { name: 'red', hex: color.red ? `#${color.red}` : '#FF0000' },
        { name: 'green', hex: color.green ? `#${color.green}` : '#00FF00' },
        { name: 'yellow', hex: color.yellow ? `#${color.yellow}` : '#FFFF00' },
        { name: 'blue', hex: color.blue ? `#${color.blue}` : '#0000FF' },
        { name: 'magenta', hex: color.magenta ? `#${color.magenta}` : '#FF00FF' },
        { name: 'cyan', hex: color.cyan ? `#${color.cyan}` : '#00FFFF' },
      ];
      return items.map(i => ({
        name: i.name,
        value: i.hex!,
        text: ColorUtil.isLight(i.hex!) ? '#000' : '#FFF'
      }));
    })
  );

  onPick(name: ColorName): void {
    this.colorSelected.emit(name);
  }
}
