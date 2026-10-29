import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { ClipboardAccess, Opener } from "@cogno/platform";
import { DIALOG_DATA, DialogRef } from "@cogno/shared/ui";
import { accessOptions, accessSummary } from "../hosts/git-host-access";
import {
  GIT_HOSTS,
  GitAccessOption,
  GitAccessSituation,
  GitHostId,
  isGitHostId,
} from "../hosts/git-hosts";

export type GitAccessDialogData = {
  readonly situation: GitAccessSituation;
  /** The host is nobody's: the person says what is behind it, and it is remembered. */
  readonly askProvider: boolean;
  readonly onProvider: (provider: GitHostId) => void;
  /** Puts the command on the terminal's input line; a reason when the terminal refused. */
  readonly onInsert: (command: string) => Promise<string | null>;
};

/**
 * How to get git access to a host, as a list of ways with their commands.
 * Nothing runs by itself: a command goes on the terminal's input line (and
 * the dialog closes, so the person can run it) or into the clipboard.
 */
@Component({
  selector: "app-git-access-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="access">
      @if (data.askProvider) {
        <label class="provider">
          <span>{{ situation().host }} is</span>
          <select [value]="situation().provider" (change)="chooseProvider(select.value)" #select>
            @for (host of hosts; track host.id) {
              <option [value]="host.id">{{ host.label }}</option>
            }
          </select>
        </label>
      }
      <p class="summary">{{ summary() }}</p>
      @for (option of options(); track option.title) {
        <section class="option">
          <h3 class="title">{{ option.title }}</h3>
          <p class="detail">{{ option.detail }}</p>
          @for (step of option.steps; track step.title) {
            <div class="step">
              <div class="step-head">
                <span class="step-title">{{ step.title }}</span>
                <span class="subtle">{{ step.detail }}</span>
              </div>
              @for (command of step.commands; track command) {
                <div class="command">
                  <code>{{ command }}</code>
                  <button type="button" class="button" (click)="insert(command)">
                    To terminal
                  </button>
                  <button type="button" class="button" (click)="clipboard.writeText(command)">Copy</button>
                </div>
              }
              @if (step.link; as link) {
                <div class="command">
                  <code class="link">{{ link }}</code>
                  <button type="button" class="button" (click)="opener.openUrl(link)">Open</button>
                </div>
              }
            </div>
          }
        </section>
      }
      @if (refusal()) {
        <p class="refusal">{{ refusal() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .access {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: min(34rem, calc(100vw - 2rem));
        max-height: 70vh;
        overflow: auto;
      }
      .provider {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      select {
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: var(--button-border-radius);
        padding: 0.3rem 0.5rem;
        font: inherit;
      }
      .summary,
      .detail,
      .refusal {
        margin: 0;
        line-height: 1.5;
      }
      .option {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: var(--button-border-radius);
      }
      .title {
        margin: 0;
        font-size: 1em;
        font-weight: 600;
      }
      .step {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding-left: 0.5rem;
      }
      .step-head {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .step-title {
        font-weight: 500;
      }
      .subtle {
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);
        font-size: 0.85em;
      }
      .command {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      code {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        padding: 0.3rem 0.5rem;
        border-radius: var(--button-border-radius);
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        font-family: var(--terminal-font-family, monospace);
        font-size: 0.9em;
      }
      .refusal {
        color: var(--error-color, inherit);
      }
    `,
  ],
})
export class GitAccessDialogComponent {
  readonly hosts = GIT_HOSTS;
  readonly situation: WritableSignal<GitAccessSituation>;
  readonly summary: Signal<string>;
  readonly options: Signal<ReadonlyArray<GitAccessOption>>;
  /** Why the last command did not reach the terminal. */
  readonly refusal = signal<string | null>(null);

  constructor(
    readonly dialogRef: DialogRef<void>,
    @Inject(DIALOG_DATA) readonly data: GitAccessDialogData,
    readonly clipboard: ClipboardAccess,
    readonly opener: Opener,
  ) {
    this.situation = signal(data.situation);
    this.summary = computed(() => accessSummary(this.situation()));
    this.options = computed(() => accessOptions(this.situation()));
  }

  chooseProvider(value: string): void {
    if (!isGitHostId(value)) return;
    this.situation.update((situation) => ({ ...situation, provider: value }));
    this.data.onProvider(value);
  }

  /** The command is on the line now: the dialog goes away so the person can run it. */
  async insert(command: string): Promise<void> {
    const refusal = await this.data.onInsert(command);
    this.refusal.set(refusal);
    if (!refusal) this.dialogRef.close();
  }
}
