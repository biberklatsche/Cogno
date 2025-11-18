import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {map, Observable} from 'rxjs';
import {ConfigService} from '../../config/+state/config.service';
import {ColorName} from "./color";

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
              @for (c of colors; track c.name) {
                  <button
                          type="button"
                          class="color-btn"
                          [style.background]="c.value"
                          [style.border]="'1px solid var(--background-color-30l)'"
                          (click)="onPick(c.name)"
                          [attr.aria-label]="c.name"
                          [title]="c.name"
                  >
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
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: .5rem;
    }
    .color-btn {
      width: 15px;
      height: 15px;
      border: none;  
      border-radius: 50%;
      opacity: 0.7;  
    }
    .color-btn:hover {opacity: 1;} 
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
      const color = cfg.color ?? {} as any;
      const items: { name: ColorName; hex?: string }[] = [
        { name: 'red', hex: this.selectedColorName !== 'red' ? `#${color.red}` : '#00000000' },
        { name: 'green', hex: this.selectedColorName !== 'green' ? `#${color.green}` : '#00000000' },
        { name: 'yellow', hex: this.selectedColorName !== 'yellow' ? `#${color.yellow}` : '#00000000' },
        { name: 'blue', hex: this.selectedColorName !== 'blue' ? `#${color.blue}` : '#00000000' },
        { name: 'magenta', hex: this.selectedColorName !== 'magenta' ? `#${color.magenta}` : '#00000000' },
        { name: 'cyan', hex: this.selectedColorName !== 'cyan' ? `#${color.cyan}` : '#00000000' },
      ];
      return items.map(i => ({
        name: i.name,
        value: i.hex!,
      }));
    })
  );

  onPick(name: ColorName): void {
    this.colorSelected.emit(name === this.selectedColorName ? undefined : name);
  }
}
