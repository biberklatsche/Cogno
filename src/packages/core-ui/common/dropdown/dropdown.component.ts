import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from "@angular/core";

export type DropdownItem<TValue extends string = string> = {
  readonly value: TValue;
  readonly label: string;
  readonly disabled?: boolean;
};

@Component({
  selector: "app-dropdown",
  standalone: true,
  template: `
    <div class="dropdown">
      <button
        type="button"
        class="dropdown__trigger"
        [class.dropdown__trigger--open]="isOpen()"
        [disabled]="disabled"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="menu"
        [attr.aria-label]="ariaLabel || label"
        (click)="toggle()">
        <span class="dropdown__label">{{ label }}</span>
        <span class="dropdown__chevron" aria-hidden="true"></span>
      </button>

      @if (isOpen()) {
        <div class="dropdown__menu" role="menu">
          @for (item of items; track item.value) {
            <button
              type="button"
              class="dropdown__item"
              [class.dropdown__item--selected]="item.value === value"
              [disabled]="item.disabled"
              role="menuitem"
              (click)="selectItem(item.value)">
              {{ item.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: inline-flex; max-width: 100%; }
      .dropdown { position: relative; display: inline-flex; max-width: 100%; }
      .dropdown__trigger {
        display: inline-flex; align-items: center; gap: 0.45rem; max-width: 100%; min-height: 1.6rem; padding: 0.15rem 0.45rem 0;
        border: 0; border-radius: 0.35rem; background: transparent; color: inherit; cursor: pointer; font: inherit; font-size: 0.9rem; font-weight: 600; line-height: 1.2;
      }
      .dropdown__trigger:hover, .dropdown__trigger:focus-visible, .dropdown__trigger--open {
        background: var(--background-color-20l); outline: none;
      }
      .dropdown__trigger:disabled { opacity: 0.55; cursor: default; }
      .dropdown__label { display: block; max-width: 15ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dropdown__chevron {
        flex: 0 0 auto; width: 0.45rem; height: 0.45rem; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.1rem) rotate(45deg); opacity: 0.8;
      }
      .dropdown__menu {
        position: absolute; right: 0; bottom: calc(100% + 0.35rem); min-width: 14rem; max-width: 20rem; padding: 0.35rem;
        border: 1px solid var(--background-color-20l); border-radius: 0.6rem; background: var(--background-color);
        box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 18%); z-index: 20;
      }
      .dropdown__item {
        display: block; width: 100%; border: 0; border-radius: 0.4rem; background: transparent; color: inherit; cursor: pointer;
        font: inherit; text-align: left; padding: 0.45rem 0.6rem;
      }
      .dropdown__item:hover, .dropdown__item:focus-visible { background: var(--background-color-20l); outline: none; }
      .dropdown__item--selected, .dropdown__item:disabled { opacity: 0.6; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownComponent<TValue extends string = string> {
  @Input() label = "";
  @Input() ariaLabel?: string;
  @Input() value?: TValue;
  @Input() items: ReadonlyArray<DropdownItem<TValue>> = [];
  @Input() disabled = false;
  @Output() readonly valueChange = new EventEmitter<TValue>();

  protected readonly isOpen = signal(false);

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  protected toggle(): void {
    if (this.disabled || this.items.length === 0) {
      return;
    }

    this.isOpen.update((isOpen) => !isOpen);
  }

  protected selectItem(value: TValue): void {
    this.isOpen.set(false);
    this.valueChange.emit(value);
  }

  @HostListener("document:click", ["$event"])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }

    const hostElement = this.elementRef.nativeElement;
    if (!hostElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscapeKey(): void {
    this.isOpen.set(false);
  }
}
