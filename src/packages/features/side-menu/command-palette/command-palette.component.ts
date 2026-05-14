import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  Signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import {
  collectDirectionalNavigationItems,
  scrollSelectedListItemIntoView,
} from "../navigation/directional-navigation.dom";
import { DirectionalNavigationItem } from "../navigation/directional-navigation.engine";
import { CommandEntry, CommandPaletteService } from "./command-palette.service";

@Component({
  selector: "app-command-palette",
  standalone: true,
  template: `
    <input
      autocomplete="off"
      spellcheck="false"
      data-private="off"
      data-side-menu-autofocus="true"
      autocorrect="off"
      type="text"
      #inputElement
      (input)="onQuery($event)"
      (click)="$event.stopPropagation()"
      placeholder="Type a command..."
      class="search-input"
    />
    @if (commandList().length > 0) {
      <ul #commandListElement class="command-list">
        @for (command of commandList(); track command.id) {
          <li
            #commandElement
            [attr.data-navigation-id]="command.id"
            (click)="fireAction(command)"
            class="command"
            [class.selected]="command.isSelected"
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
        margin: 0;
        padding: 0;
        font-size: 0.9rem;
        width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .search-input {
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid var(--background-color-20l);
        background: var(--background-color-10l);
        color: inherit;
        outline: none;
        box-sizing: border-box;
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
        background: var(--background-color-20l);
        opacity: 1;
        outline: none;
      }

      .command.selected {
        background: var(--background-color-20l);
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
  private readonly commandListElement =
    viewChild<ElementRef<HTMLUListElement>>("commandListElement");
  private readonly commandElements = viewChildren<ElementRef<HTMLElement>>("commandElement");
  private readonly navigationItemsProvider = () => this.collectNavigationItems();

  constructor(
    private readonly commandPaletteService: CommandPaletteService,
    destroyRef: DestroyRef,
  ) {
    this.commandList = this.commandPaletteService.filteredCommandList;
    this.commandPaletteService.registerNavigationItemsProvider(this.navigationItemsProvider);
    destroyRef.onDestroy(() => {
      this.commandPaletteService.unregisterNavigationItemsProvider(this.navigationItemsProvider);
    });

    effect(() => {
      const commandList = this.commandList();
      if (commandList.length === 0) {
        return;
      }

      const commandListElement = this.commandListElement()?.nativeElement;
      if (!commandListElement) {
        return;
      }

      const selectedIndex = commandList.findIndex((commandEntry) => commandEntry.isSelected);
      if (selectedIndex < 0) {
        return;
      }

      scrollSelectedListItemIntoView(commandListElement, selectedIndex);
    });
  }

  onQuery(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.commandPaletteService.filterCommands(inputElement.value);
  }

  fireAction(commandEntry?: CommandEntry): void {
    this.commandPaletteService.fireSelectedAction(commandEntry);
  }

  private collectNavigationItems(): ReadonlyArray<DirectionalNavigationItem<string>> {
    return collectDirectionalNavigationItems(this.commandElements());
  }
}
