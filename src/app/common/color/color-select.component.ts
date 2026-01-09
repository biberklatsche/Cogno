import {Component, EventEmitter, input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {map, Observable} from 'rxjs';
import {ConfigService} from '../../config/+state/config.service';
import {ColorName} from "./color";
import {Color} from "../../config/+models/config";

interface ColorItem {
  name: ColorName;
  value: string; // hex with leading '#'
}

@Component({
  selector: 'app-color-select',
  standalone: true,
  imports: [CommonModule],
  template: `
      @if (colors$ | async; as colors) {
          <div class="color-grid">
              @if(showDefault()) {
                  <button
                          type="button"
                          class="color-btn default-btn"
                          (click)="onPick('default')"
                          [title]="'default'">
                  </button>
              }
              @for (c of colors; track c.name) {
                  <button
                          type="button"
                          class="color-btn"
                          [style.background]="c.value"
                          (click)="onPick(c.name)"
                          [title]="c.name"
                  >
                      @if (c.name === selectedColorName()) {
                          <div class="selector" [style.border-color]="c.value"></div>
                      }
                  </button>
              }
          </div>
      }
  `,
  styles: [
    `
    :host { display: block; }
    .color-grid {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
    .color-btn {
      width: 14px;
      height: 14px;
      border: none;
        padding: 4px;
        box-sizing: border-box;
      border-radius: 50%;
        position: relative;
      opacity: 0.7;
        &:hover {opacity: 1;}
        &.default-btn {
            border: 1px solid var(--background-color-40l);
            background-color: transparent;
        }
    }
    .selector {
        position: absolute;
        top: -3px;
        bottom: -3px;
        left: -3px;
        right: -3px;
        border-radius: 50%;
        border: 1px solid;
    }
    `
  ]
})
export class ColorSelectComponent {
  @Output() colorSelected = new EventEmitter<ColorName>();
  selectedColorName = input<ColorName | undefined>();
  showDefault= input<boolean>(true);

  constructor(private readonly config: ConfigService) {}

  readonly colors$: Observable<ColorItem[]> = this.config.config$.pipe(
    map(cfg => {
      const color: Color = cfg.color!;
      const items: { name: ColorName; hex?: string}[] = [
        { name: 'red', hex: `#${color.red}`},
        { name: 'green', hex: `#${color.green}` },
        { name: 'yellow', hex: `#${color.yellow}` },
        { name: 'blue', hex: `#${color.blue}`  },
        { name: 'magenta', hex: `#${color.magenta}`  },
        { name: 'cyan', hex: `#${color.cyan}`},
      ];
      return items.map(i => ({
        name: i.name,
        value: i.hex!,
      }));
    })
  );

  onPick(name: ColorName | 'default'): void {
    this.colorSelected.emit(name === 'default' ? undefined : name);
  }
}
