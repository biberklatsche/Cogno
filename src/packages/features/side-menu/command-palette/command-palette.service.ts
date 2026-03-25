import { DestroyRef, Inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  CommandPaletteActionDefinitionContract,
  CommandPaletteCommandEntryContract,
  CommandPaletteHostPortContract,
  commandPaletteHostPortToken,
} from "@cogno/core-sdk";
import {
  DirectionalNavigationItem,
  NavigationDirection,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

export type CommandEntry = {
  readonly isSelected: boolean;
  readonly label: string;
  readonly keybinding: string;
  readonly actionDefinition: CommandPaletteActionDefinitionContract;
};

@Injectable({ providedIn: "root" })
export class CommandPaletteService {
  private readonly commandListSignal = signal<CommandEntry[]>([]);
  private readonly filteredCommandListSignal = signal<CommandEntry[]>([]);
  private readonly querySignal = signal("");
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

  readonly filteredCommandList = this.filteredCommandListSignal.asReadonly();

  constructor(
    @Inject(commandPaletteHostPortToken)
    private readonly commandPaletteHostPort: CommandPaletteHostPortContract,
    destroyRef: DestroyRef,
  ) {
    this.commandPaletteHostPort.commandEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((commandEntries) => {
        this.updateCommandEntries(commandEntries);
      });
  }

  handleSideMenuOpen(): void {
    this.applyFilter(this.querySignal());
  }

  handleSideMenuClose(): void {
    this.querySignal.set("");
    this.filteredCommandListSignal.set(this.withFirstSelected(this.commandListSignal().map((commandEntry) => ({
      ...commandEntry,
      isSelected: false,
    }))));
  }

  fireSelectedAction(commandEntry?: CommandEntry): void {
    const selectedCommandEntry = commandEntry ?? this.filteredCommandListSignal().find((entry) => entry.isSelected);
    if (!selectedCommandEntry) {
      return;
    }

    setTimeout(() => {
      this.commandPaletteHostPort.publishAction(selectedCommandEntry.actionDefinition);
    }, 50);
  }

  filterCommands(query: string): void {
    this.querySignal.set(query);
    this.applyFilter(query);
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

  private updateCommandEntries(commandEntries: ReadonlyArray<CommandPaletteCommandEntryContract>): void {
    const commandList = commandEntries
      .map((commandEntry) => ({
        isSelected: false,
        label: commandEntry.actionDefinition.actionName.replaceAll("_", " "),
        keybinding: commandEntry.keybinding,
        actionDefinition: commandEntry.actionDefinition,
      }))
      .sort((firstEntry, secondEntry) => firstEntry.label.localeCompare(secondEntry.label));

    this.commandListSignal.set(this.withFirstSelected(commandList));
    this.applyFilter(this.querySignal());
  }

  private applyFilter(query: string): void {
    const normalizedQuery = query.toLowerCase();
    const filteredCommandList = this.commandListSignal()
      .filter((commandEntry) => commandEntry.label.toLowerCase().includes(normalizedQuery))
      .map((commandEntry) => ({ ...commandEntry, isSelected: false }));

    this.filteredCommandListSignal.set(this.withFirstSelected(filteredCommandList));
  }

  private selectNextCommand(direction: NavigationDirection): void {
    const currentFilteredCommandList = this.filteredCommandListSignal();
    if (currentFilteredCommandList.length === 0) {
      return;
    }

    const selectedIndex = currentFilteredCommandList.findIndex((commandEntry) => commandEntry.isSelected);
    const nextIndex = this.resolveNextIndex(currentFilteredCommandList, selectedIndex, direction);
    const updatedCommandList = currentFilteredCommandList.map((commandEntry, index) => ({
      ...commandEntry,
      isSelected: index === nextIndex,
    }));

    this.filteredCommandListSignal.set(updatedCommandList);
  }

  private withFirstSelected(commandEntries: CommandEntry[]): CommandEntry[] {
    if (commandEntries.length === 0) {
      return commandEntries;
    }

    return commandEntries.map((commandEntry, index) => ({
      ...commandEntry,
      isSelected: index === 0,
    }));
  }

  private resolveNextIndex(
    commandEntries: ReadonlyArray<CommandEntry>,
    currentIndex: number,
    direction: NavigationDirection,
  ): number {
    if (commandEntries.length === 0) {
      return -1;
    }

    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const activeCommandLabel = commandEntries[safeCurrentIndex]?.label;
    const navigationItems = this.navigationItemsProvider?.() ?? [];
    const nextId = resolveNextNavigationTarget({
      items: navigationItems,
      activeId: activeCommandLabel,
      direction,
      wrap: true,
    });

    if (nextId) {
      const nextIndex = commandEntries.findIndex((commandEntry) => commandEntry.label === nextId);
      if (nextIndex >= 0) {
        return nextIndex;
      }
    }

    if (direction === "down" || direction === "right") {
      return (safeCurrentIndex + 1) % commandEntries.length;
    }

    return (safeCurrentIndex - 1 + commandEntries.length) % commandEntries.length;
  }
}
