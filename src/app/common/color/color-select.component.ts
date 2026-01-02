import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {map, Observable} from 'rxjs';
import {ConfigService} from '../../config/+state/config.service';
import {ColorName} from "./color";
import {Color} from "../../config/+models/config.types";

interface ColorItem {
  name: ColorName;
  value: string; // hex with leading '#'
    isSelected: boolean;
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
                          (click)="onPick(c.name)"
                          [title]="c.name"
                  >
                      @if (c.isSelected) {
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorSelectComponent {
  @Output() colorSelected = new EventEmitter<ColorName>();
  @Input() selectedColorName: ColorName | undefined;

  constructor(private readonly config: ConfigService) {}

  readonly colors$: Observable<ColorItem[]> = this.config.config$.pipe(
    map(cfg => {
      const color: Color = cfg.color!;
      const items: { name: ColorName; hex?: string; isSelected: boolean }[] = [
        { name: 'red', hex: `#${color.red}`, isSelected: this.selectedColorName === 'red'},
        { name: 'green', hex: `#${color.green}`, isSelected: this.selectedColorName === 'green' },
        { name: 'yellow', hex: `#${color.yellow}` , isSelected: this.selectedColorName === 'yellow' },
        { name: 'blue', hex: `#${color.blue}` , isSelected: this.selectedColorName === 'blue' },
        { name: 'magenta', hex: `#${color.magenta}` , isSelected: this.selectedColorName === 'magenta' },
        { name: 'cyan', hex: `#${color.cyan}` , isSelected: this.selectedColorName === 'cyan' },
      ];
      return items.map(i => ({
        name: i.name,
        value: i.hex!,
          isSelected: i.isSelected,
      }));
    })
  );

  onPick(name: ColorName): void {
    this.colorSelected.emit(name === this.selectedColorName ? undefined : name);
  }
}
