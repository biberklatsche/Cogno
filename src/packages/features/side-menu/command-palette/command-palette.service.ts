import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  CommandPaletteHostPort,
} from "@cogno/core-api";
import {
  CommandDiscoveryEntryState as CommandEntry,
  CommandDiscoveryState,
  CommandDiscoveryUseCase,
} from "@cogno/core-domain";
import {
  DirectionalNavigationItem,
  NavigationDirection,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

export type { CommandEntry };

@Injectable({ providedIn: "root" })
export class CommandPaletteService {
  private readonly commandPaletteStateSignal = signal<CommandDiscoveryState>(
    CommandDiscoveryUseCase.createInitialState(),
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
          CommandDiscoveryUseCase.updateCommandEntries(
            this.commandPaletteStateSignal(),
            commandEntries,
          ),
        );
      });
  }

  handleSideMenuOpen(): void {
    this.applyState(CommandDiscoveryUseCase.handleCollectionOpen(this.commandPaletteStateSignal()));
  }

  handleSideMenuClose(): void {
    this.applyState(CommandDiscoveryUseCase.handleCollectionClose(this.commandPaletteStateSignal()));
  }

  fireSelectedAction(commandEntry?: CommandEntry): void {
    const selectedCommandEntry = CommandDiscoveryUseCase.getSelectedEntry(this.commandPaletteStateSignal(), commandEntry);
    if (!selectedCommandEntry) {
      return;
    }

    setTimeout(() => {
      this.commandPaletteHostPort.publishAction(selectedCommandEntry.actionDefinition);
    }, 50);
  }

  filterCommands(query: string): void {
    this.applyState(CommandDiscoveryUseCase.filterCommands(this.commandPaletteStateSignal(), query));
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
      CommandDiscoveryUseCase.selectNextCommand(
        this.commandPaletteStateSignal(),
        direction,
        (activeCommandId, nextDirection) =>
          resolveNextNavigationTarget({
            items: this.navigationItemsProvider?.() ?? [],
            activeId: activeCommandId,
            direction: nextDirection,
            wrap: true,
          }) ?? undefined,
      ),
    );
  }

  private applyState(state: CommandDiscoveryState): void {
    this.commandPaletteStateSignal.set(state);
    this.filteredCommandListSignal.set([...state.filteredCommandList]);
  }
}
