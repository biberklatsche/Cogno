import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Signal,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import {
  describeSettings,
  SettingDescriptor,
} from "@cogno/core/infrastructure/config/config-schema-walker";
import {
  defaultSettings,
  platformSettingOverrides,
} from "@cogno/core/infrastructure/config/models/default-config-values";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { OsPlatform } from "@cogno/platform/os";
import {
  ColorFieldComponent,
  IconComponent,
  ToggleSwitchComponent,
  TooltipDirective,
} from "@cogno/shared/ui";
import {
  buildSettingsView,
  headingsBefore,
  parseInput,
  SettingHeading,
  SettingRow,
} from "./settings-view";

/**
 * Every setting, from the schema: searchable, grouped by section, each with
 * its description, default and a control for its type. A change is written
 * to the settings file at once and read back from it, so what the panel shows
 * is what the file says. Maps of user-named entries and keybinds are edited
 * in the file; the panel says so and opens it.
 */
@Component({
  selector: "app-settings-panel",
  standalone: true,
  imports: [ColorFieldComponent, IconComponent, ToggleSwitchComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search">
      <input
        type="search"
        placeholder="Search settings"
        autocomplete="off"
        spellcheck="false"
        data-side-menu-autofocus="true"
        [value]="query()"
        (input)="query.set(search.value)"
        #search
      />
    </div>

    <div class="body">
      <nav class="sections">
        @for (section of view().sections; track section.title) {
          <button
            type="button"
            class="section"
            [class.active]="!searching() && section.title === activeSection()"
            (click)="activeSection.set(section.title); query.set('')"
          >
            <span>{{ section.title }}</span>
            @if (searching()) {
              <span class="count">{{ section.count }}</span>
            }
          </button>
        }
      </nav>
      <select class="sections-select" [value]="activeSection()" (change)="activeSection.set(select.value); query.set('')" #select>
        @for (section of view().sections; track section.title) {
          <option [value]="section.title">{{ section.title }}</option>
        }
      </select>

      <div class="rows">
        @if (view().rows.length === 0) {
          <p class="empty">No setting matches.</p>
        }
        @for (row of view().rows; track row.key; let index = $index) {
          @for (heading of headingsBefore(index); track heading.key) {
            <h3 class="group" [class]="'group level-' + heading.level">{{ heading.title }}</h3>
            @if (heading.description) {
              <p class="group-description">{{ heading.description }}</p>
            }
          }
          <section class="row">
            <header class="row-head">
              <code class="key">{{ row.key }}</code>
              <!-- Always in the layout, so a row never changes height when it becomes modified. -->
              <button
                type="button"
                class="button icon-button reset"
                [class.hidden]="!row.modified"
                [attr.aria-hidden]="!row.modified"
                [tabindex]="row.modified ? 0 : -1"
                appTooltip="Reset to default"
                (click)="reset(row)"
              >
                <app-icon name="mdiUndoVariant"></app-icon>
              </button>
            </header>
            <p class="description">{{ row.description }}</p>
            @switch (row.control.kind) {
              @case ("boolean") {
                <button type="button" class="toggle" (click)="write(row, row.value === 'true' ? 'false' : 'true')">
                  <app-toggle-switch [checked]="row.value === 'true'"></app-toggle-switch>
                  <span>{{ row.value === "true" ? "On" : "Off" }}</span>
                </button>
              }
              @case ("enum") {
                <select [value]="row.value" (change)="write(row, enumSelect.value)" #enumSelect>
                  @for (option of row.control.values; track option) {
                    <option [value]="option">{{ option }}</option>
                  }
                </select>
              }
              @case ("number") {
                <input
                  type="number"
                  [value]="row.value"
                  [min]="row.control.min ?? null"
                  [max]="row.control.max ?? null"
                  [step]="row.control.integer ? 1 : 'any'"
                  (change)="write(row, numberInput.value)"
                  #numberInput
                />
              }
              @case ("string") {
                @if (row.control.hexColor) {
                  <app-color-field
                    [value]="row.value"
                    [placeholder]="row.default ?? ''"
                    (valueChange)="write(row, $event)"
                  ></app-color-field>
                } @else {
                  <input
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    [value]="row.value"
                    [placeholder]="row.default ?? ''"
                    (change)="write(row, stringInput.value)"
                    #stringInput
                  />
                }
              }
              @case ("file-only") {
                <button type="button" class="button small" (click)="openConfigFile()">
                  <app-icon name="mdiOpenInNew"></app-icon>
                  Edit in settings file
                </button>
              }
              @default {
                <input
                  type="text"
                  spellcheck="false"
                  autocomplete="off"
                  [value]="row.value"
                  [placeholder]="row.default ?? ''"
                  (change)="write(row, textInput.value)"
                  #textInput
                />
              }
            }
            @if (errors()[row.key]; as error) {
              <p class="error">{{ error }}</p>
            } @else if (row.default !== undefined && row.control.kind !== "file-only") {
              <p class="default">Default: <code>{{ row.default === "" ? "(empty)" : row.default }}</code></p>
            }
          </section>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 0.5rem;
        font-size: var(--panel-font-size);
        container-type: inline-size;
      }
      .search {
        flex: 0 0 auto;
      }
      .body {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .sections {
        display: none;
        flex: 0 0 10rem;
        flex-direction: column;
        gap: 2px;
        overflow: auto;
      }
      .sections-select {
        display: block;
        width: 100%;
      }
      /* Wide enough for two columns: the sections stand on the left, as in a settings app. */
      @container (min-width: 520px) {
        .body {
          flex-direction: row;
        }
        .sections {
          display: flex;
        }
        .sections-select {
          display: none;
        }
      }
      .section {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.35rem 0.5rem;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        opacity: 0.8;
      }
      .section:hover,
      .section.active {
        opacity: 1;
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      }
      .count {
        opacity: 0.6;
      }
      .rows {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-right: 0.25rem;
      }
      /* Headings step down with depth: section, group, subgroup, and anything deeper. */
      .group {
        margin: 1rem 0 0.2rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .group.level-0 {
        font-size: 1rem;
        margin-top: 1.4rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-3)), var(--background-color));
      }
      .group.level-1 {
        font-size: 0.85rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.85;
      }
      .group.level-2 {
        font-size: 0.8rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.6;
        margin-top: 0.8rem;
      }
      .group.level-3,
      .group.level-4,
      .group.level-5 {
        font-size: 0.8rem;
        font-weight: 500;
        opacity: 0.7;
        margin: 0.5rem 0 0.1rem 0.6rem;
      }
      .rows > .group:first-child {
        margin-top: 0;
      }
      .group-description {
        margin: 0 0 0.3rem;
        font-size: 0.8em;
        opacity: 0.6;
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.5rem 0.6rem;
        border-radius: 4px;
      }
      .row:hover {
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
      }
      .row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        /* The reset button's height, whether it is shown or not. */
        min-height: 26px;
      }
      .reset.hidden {
        visibility: hidden;
        pointer-events: none;
      }
      .key {
        font-family: var(--terminal-font-family, monospace);
        font-size: 0.9em;
        overflow-wrap: anywhere;
      }
      .description {
        margin: 0;
        opacity: 0.8;
        line-height: 1.4;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        align-self: flex-start;
        padding: 0.2rem 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .row input,
      .row select,
      .row app-color-field {
        max-width: 24rem;
        font-size: inherit;
      }
      .default,
      .error,
      .empty {
        margin: 0;
        font-size: 0.8em;
        opacity: 0.6;
      }
      .error {
        opacity: 1;
        color: var(--color-red, inherit);
      }
      .button.small {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
    `,
  ],
})
export class SettingsPanelComponent {
  readonly query = signal("");
  readonly activeSection = signal("General");
  readonly searching = computed(() => this.query().trim().length > 0);
  /** Why the last write of a key was refused; cleared by the next successful one. */
  readonly errors = signal<Readonly<Record<string, string>>>({});
  readonly view: Signal<ReturnType<typeof buildSettingsView>>;

  private readonly configuration = signal<Readonly<Record<string, unknown>> | undefined>(undefined);
  private readonly userKeys = signal<ReadonlySet<string>>(new Set());
  private readonly descriptors: ReadonlyArray<SettingDescriptor>;

  constructor(
    private readonly config: ConfigService,
    private readonly bus: AppBus,
    os: OsPlatform,
    destroyRef: DestroyRef,
  ) {
    const platform = os.platform();
    this.descriptors = describeSettings(config.schema.shape, {
      defaults: defaultSettings,
      platformOverrides: platformSettingOverrides,
    });
    config.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((configuration) => this.configuration.set(configuration));
    config.userKeys$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((keys) => this.userKeys.set(keys));
    this.view = computed(() =>
      buildSettingsView({
        descriptors: this.descriptors,
        configuration: this.configuration(),
        userKeys: this.userKeys(),
        platform,
        section: this.activeSection(),
        query: this.query(),
      }),
    );
  }

  headingsBefore(index: number): ReadonlyArray<SettingHeading> {
    return headingsBefore(this.view().rows, index, this.searching());
  }

  write(row: SettingRow, text: string): void {
    const parsed = parseInput(row.control, text);
    if ("error" in parsed) {
      this.errors.update((errors) => ({ ...errors, [row.key]: parsed.error }));
      return;
    }
    void this.config
      .update({ [row.key]: parsed.value })
      .then(() => this.errors.update(({ [row.key]: _, ...rest }) => rest))
      .catch((error: unknown) =>
        this.errors.update((errors) => ({
          ...errors,
          [row.key]: error instanceof Error ? error.message : String(error),
        })),
      );
  }

  /** Takes the key out of the file; the default applies again. */
  reset(row: SettingRow): void {
    void this.config.update({ [row.key]: undefined });
  }

  openConfigFile(): void {
    this.bus.publish(ActionFired.create("open_config"));
  }
}
