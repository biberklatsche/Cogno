import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionDefinitionContract } from "@cogno/shared/domain";
import { ActionCatalog, ActionDispatcher } from "@cogno/shared/ports";

export interface CommandEntry {
  readonly id: string;
  readonly label: string;
  readonly keybinding: string;
  readonly actionDefinition: ActionDefinitionContract;
}

function nameInWords(actionName: string): string {
  return actionName.replaceAll("_", " ");
}

@Injectable({ providedIn: "root" })
export class CommandPaletteService {
  private readonly commandEntries = signal<CommandEntry[]>([]);
  private readonly query = signal("");
  private readonly selectedIndexSignal = signal(0);

  /** Found by what is shown, and by the action's name: "Settings" is `open_config`. */
  readonly filteredCommandList = computed(() => {
    const normalizedQuery = this.query().toLowerCase();
    return this.commandEntries().filter(
      (commandEntry) =>
        commandEntry.label.toLowerCase().includes(normalizedQuery) ||
        nameInWords(commandEntry.id).toLowerCase().includes(normalizedQuery),
    );
  });
  readonly selectedIndex = this.selectedIndexSignal.asReadonly();
  readonly selectedEntry = computed<CommandEntry | undefined>(
    () => this.filteredCommandList()[this.selectedIndex()],
  );

  constructor(
    private readonly actionCatalog: ActionCatalog,
    private readonly actionDispatcher: ActionDispatcher,
    destroyRef: DestroyRef,
  ) {
    this.actionCatalog.actionEntries$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((actionEntries) => {
        this.commandEntries.set(
          actionEntries
            .map((actionEntry) => ({
              id: actionEntry.actionDefinition.actionName,
              label: actionEntry.label ?? nameInWords(actionEntry.actionDefinition.actionName),
              keybinding: actionEntry.keybinding,
              actionDefinition: actionEntry.actionDefinition,
            }))
            .sort((firstEntry, secondEntry) => firstEntry.label.localeCompare(secondEntry.label)),
        );
        this.selectedIndexSignal.set(0);
      });
  }

  handleSideMenuOpen(): void {
    this.selectedIndexSignal.set(0);
  }

  handleSideMenuClose(): void {
    this.filterCommands("");
  }

  fireSelectedAction(commandEntry?: CommandEntry): void {
    const selectedCommandEntry = commandEntry ?? this.selectedEntry();
    if (!selectedCommandEntry) {
      return;
    }

    this.actionDispatcher.dispatchAction(selectedCommandEntry.actionDefinition);
  }

  filterCommands(query: string): void {
    this.query.set(query);
    this.selectedIndexSignal.set(0);
  }

  /** Moves the selection one row down (1) or up (-1), wrapping around at both ends. */
  move(delta: 1 | -1): void {
    const commandCount = this.filteredCommandList().length;
    if (commandCount === 0) {
      return;
    }

    this.selectedIndexSignal.update(
      (selectedIndex) => (selectedIndex + delta + commandCount) % commandCount,
    );
  }
}
