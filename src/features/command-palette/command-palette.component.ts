import { Component, ElementRef, effect, Signal, viewChild } from "@angular/core";
import { SideMenuSearchInputComponent } from "@cogno/shared/ui";
import { scrollSelectedListItemIntoView } from "@cogno/shared/ui/common/navigation/scroll-selected-list-item";
import { CommandEntry, CommandPaletteService } from "./command-palette.service";

@Component({
  selector: "app-command-palette",
  standalone: true,
  imports: [SideMenuSearchInputComponent],
  template: `
    <app-side-menu-search-input
      class="search-input"
      placeholder="Type a command..."
      (query)="commandPaletteService.filterCommands($event)"
    ></app-side-menu-search-input>
    @if (commandList().length > 0) {
      <ul #commandListElement class="command-list">
        @for (command of commandList(); track command.id) {
          <li
            (click)="fireAction(command)"
            class="command"
            [class.selected]="$index === selectedIndex()"
          >
            <span class="label">{{ command.label }}</span>
            <span class="keybinding">{{ command.keybinding }}</span>
          </li>
        }
      </ul>
    } @else {
      <div class="no-results">No matches</div>
    }
  `,
  styles: [
    `
      :host {
        padding: 0.25rem 0 0;
        margin: 0;
        font-size: 0.9rem;
        width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .search-input {
        width: 100%;
        margin-bottom: 1rem;
      }

      .command-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow: auto;
        flex: 1;
      }

      .command {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        text-transform: capitalize;
        padding: 8px 10px;
        gap: 1rem;
        cursor: default;
        opacity: 0.7;
      }

      .command:hover {
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        opacity: 1;
        outline: none;
      }

      .command.selected {
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        opacity: 1;
        outline: none;
      }

      .no-results {
        opacity: 0.6;
        font-size: 0.9em;
        padding: 4px 2px;
      }
    `,
  ],
})
export class CommandPaletteComponent {
  readonly commandList: Signal<CommandEntry[]>;
  readonly selectedIndex: Signal<number>;
  private readonly commandListElement =
    viewChild<ElementRef<HTMLUListElement>>("commandListElement");

  constructor(readonly commandPaletteService: CommandPaletteService) {
    this.commandList = this.commandPaletteService.filteredCommandList;
    this.selectedIndex = this.commandPaletteService.selectedIndex;

    effect(() => {
      // A new list scrolls back to its selected row, even if the index stays the same.
      if (this.commandList().length === 0) {
        return;
      }

      scrollSelectedListItemIntoView(
        this.commandListElement()?.nativeElement,
        this.selectedIndex(),
      );
    });
  }

  fireAction(commandEntry: CommandEntry): void {
    this.commandPaletteService.fireSelectedAction(commandEntry);
  }
}
