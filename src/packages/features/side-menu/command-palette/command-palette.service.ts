import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommandPaletteHostPort } from "@cogno/core-api";
import {
  CommandPaletteEntryState as CommandEntry,
  CommandPaletteState,
  CommandPaletteUseCase,
} from "@cogno/core-domain";
import {
  DirectionalNavigationItem,
  NavigationDirection,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

export type { CommandEntry };

@Injectable({ providedIn: "root" })
export class CommandPaletteService {
  private readonly commandPaletteStateSignal = signal<CommandPaletteState>(
    CommandPaletteUseCase.createInitialState(),
  );
  private readonly filteredCommandListSignal = signal<CommandEntry[]>([]);
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

  readonly filteredCommandList = this.filteredCommandListSignal.asReadonly();

  constructor(
    private readonly commandPaletteHostPort: CommandPaletteHostPort,
    destroyRef: DestroyRef,
  ) {
    this.commandPaletteHostPort.commandEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((commandEntries) => {
        this.applyState(
          CommandPaletteUseCase.updateCommandEntries(
            this.commandPaletteStateSignal(),
            commandEntries,
          ),
        );
      });
  }

  handleSideMenuOpen(): void {
    this.applyState(CommandPaletteUseCase.handleSideMenuOpen(this.commandPaletteStateSignal()));
  }

  handleSideMenuClose(): void {
    this.applyState(CommandPaletteUseCase.handleSideMenuClose(this.commandPaletteStateSignal()));
  }

  fireSelectedAction(commandEntry?: CommandEntry): void {
    const selectedCommandEntry = CommandPaletteUseCase.getSelectedEntry(this.commandPaletteStateSignal(), commandEntry);
    if (!selectedCommandEntry) {
      return;
    }

    setTimeout(() => {
      this.commandPaletteHostPort.publishAction(selectedCommandEntry.actionDefinition);
    }, 50);
  }

  filterCommands(query: string): void {
    this.applyState(CommandPaletteUseCase.filterCommands(this.commandPaletteStateSignal(), query));
  }

  handleNavigationKey(key: string): void {
    if (key === "ArrowDown") {
      this.selectNextCommand("down");
      return;
    }
    if (key === "ArrowUp") {
      this.selectNextCommand("up");
    }
  }

  registerNavigationItemsProvider(provider: () => ReadonlyArray<DirectionalNavigationItem<string>>): void {
    this.navigationItemsProvider = provider;
  }

  unregisterNavigationItemsProvider(provider: () => ReadonlyArray<DirectionalNavigationItem<string>>): void {
    if (this.navigationItemsProvider === provider) {
      this.navigationItemsProvider = undefined;
    }
  }

  private selectNextCommand(direction: NavigationDirection): void {
    this.applyState(
      CommandPaletteUseCase.selectNextCommand(
        this.commandPaletteStateSignal(),
        direction,
        (activeCommandLabel, nextDirection) =>
          resolveNextNavigationTarget({
            items: this.navigationItemsProvider?.() ?? [],
            activeId: activeCommandLabel,
            direction: nextDirection,
            wrap: true,
          }) ?? undefined,
      ),
    );
  }

  private applyState(state: CommandPaletteState): void {
    this.commandPaletteStateSignal.set(state);
    this.filteredCommandListSignal.set([...state.filteredCommandList]);
  }
}
