import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  ViewChild,
} from "@angular/core";
import { DropdownItem } from "../dropdown/dropdown.component";

export type FilterableDropdownGroup<TValue extends string = string> = {
  readonly label?: string;
  readonly items: ReadonlyArray<DropdownItem<TValue>>;
};

@Component({
  selector: "app-filterable-dropdown",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fd">
      <button
        type="button"
        class="fd__trigger"
        [class.fd__trigger--open]="isOpen()"
        [disabled]="disabled()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="listbox"
        [attr.aria-label]="ariaLabel() ?? label()"
        (click)="toggle()"
      >
        <span class="fd__label">{{ label() }}</span>
        <span class="fd__chevron" aria-hidden="true"></span>
      </button>

      @if (isOpen()) {
        <div class="fd__panel">
          <div class="fd__search-wrap">
            <input
              #filterInput
              type="text"
              class="fd__search"
              [placeholder]="placeholder()"
              [value]="filterText()"
              (input)="onFilterInput($event)"
            />
          </div>
          <div class="fd__items">
            @if (loading()) {
              <div class="fd__empty">Loading…</div>
            } @else if (filteredGroups().length === 0) {
              <div class="fd__empty">No results</div>
            } @else {
              @for (group of filteredGroups(); track $index) {
                @if (group.label) {
                  <div class="fd__group-label">{{ group.label }}</div>
                }
                @for (item of group.items; track item.value) {
                  <button
                    type="button"
                    class="fd__item"
                    [class.fd__item--selected]="item.value === value()"
                    [disabled]="item.disabled"
                    role="option"
                    [attr.aria-selected]="item.value === value()"
                    (click)="selectItem(item.value)"
                  >
                    {{ item.label }}
                  </button>
                }
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        max-width: 100%;
      }

      .fd {
        position: relative;
        display: inline-flex;
        max-width: 100%;
      }

      .fd__trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        max-width: 100%;
        min-height: 1.6rem;
        padding: 0.15rem 0.45rem 0;
        border: 0;
        border-radius: 0.35rem;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
      }

      .fd__trigger:hover,
      .fd__trigger:focus-visible,
      .fd__trigger--open {
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        outline: none;
      }

      .fd__trigger:disabled {
        opacity: 0.55;
        cursor: default;
      }

      .fd__label {
        display: block;
        max-width: 16ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .fd__chevron {
        flex: 0 0 auto;
        width: 0.45rem;
        height: 0.45rem;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.1rem) rotate(45deg);
        opacity: 0.8;
      }

      .fd__panel {
        position: absolute;
        left: 0;
        top: calc(100% + 0.35rem);
        min-width: 16rem;
        max-width: 26rem;
        max-height: 22rem;
        display: flex;
        flex-direction: column;
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: 0.6rem;
        background: var(--background-color);
        box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 20%);
        z-index: 20;
        padding: 0.35rem;
      }

      .fd__search-wrap {
        flex: 0 0 auto;
        padding-bottom: 0.3rem;
      }

      .fd__search {
        width: 100%;
        box-sizing: border-box;
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: 0.35rem;
        color: inherit;
        font: inherit;
        font-size: 0.85rem;
        padding: 0.3rem 0.5rem;
        outline: none;
      }

      .fd__search:focus {
        border-color: var(--highlight-color);
      }

      .fd__items {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      .fd__group-label {
        padding: 0.3rem 0.6rem 0.15rem;
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .fd__item {
        display: block;
        width: 100%;
        border: 0;
        border-radius: 0.4rem;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        text-align: left;
        padding: 0.35rem 0.6rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .fd__item:hover,
      .fd__item:focus-visible {
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        outline: none;
      }

      .fd__item--selected {
        color: var(--highlight-color);
      }

      .fd__item:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .fd__empty {
        padding: 0.5rem 0.6rem;
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
        font-size: 0.85rem;
        font-style: italic;
      }
    `,
  ],
})
export class FilterableDropdownComponent<TValue extends string = string> {
  readonly label = input("");
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly value = input<TValue | undefined>(undefined);
  readonly loading = input(false);
  readonly placeholder = input("Filter…");
  readonly disabled = input(false);
  readonly groups = input<ReadonlyArray<FilterableDropdownGroup<TValue>>>([]);

  readonly valueChange = output<TValue>();
  readonly opened = output<void>();

  @ViewChild("filterInput") private readonly filterInputRef?: ElementRef<HTMLInputElement>;

  protected readonly isOpen = signal(false);
  protected readonly filterText = signal("");

  protected readonly filteredGroups = computed(() => {
    const q = this.filterText().toLowerCase().trim();
    const groups = this.groups();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  });

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.isOpen()) {
      this.close();
    } else {
      this.openPanel();
    }
  }

  private openPanel(): void {
    this.filterText.set("");
    this.isOpen.set(true);
    this.opened.emit();
    setTimeout(() => this.filterInputRef?.nativeElement.focus(), 0);
  }

  private close(): void {
    this.isOpen.set(false);
    this.filterText.set("");
  }

  protected onFilterInput(event: Event): void {
    this.filterText.set((event.target as HTMLInputElement).value);
  }

  protected selectItem(value: TValue): void {
    this.close();
    this.valueChange.emit(value);
  }

  @HostListener("document:click", ["$event"])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscapeKey(): void {
    this.close();
  }
}
