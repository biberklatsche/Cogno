import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Output,
  signal,
} from "@angular/core";
import { PairingPort } from "@cogno/core/api/pairing-port";
import { isHostError } from "@cogno/platform";

/** How far pairing by code is: the code being typed, the other machine asking its user, done. */
type PairStep =
  | { readonly step: "entering" }
  | { readonly step: "waiting"; readonly check?: string }
  | { readonly step: "paired"; readonly name: string };

/** Why pairing did not work, in words for the user. */
function failureText(error: unknown): string {
  if (isHostError(error, "pairingCodeUnknown")) {
    return "No machine shows this code. Check it, or create a new one on the other machine.";
  }
  if (isHostError(error, "pairingDeclined")) {
    return "The other machine did not allow the pairing.";
  }
  if (isHostError(error, "pairingOff")) {
    return "Pairing is off on this machine. Switch the Remote feature off and on to try again.";
  }
  // Unreachable: the app says what could not be reached.
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pairs this machine with another one by the code that one shows. While the
 * other machine asks its user, both show the same check number.
 */
@Component({
  selector: "app-remote-pair-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="pair-form" (submit)="pair($event)">
      @switch (state().step) {
        @case ("paired") {
          <div class="status">Paired with {{ pairedName() }}.</div>
          <div class="form-actions">
            <button type="button" class="button" (click)="closed.emit()">Done</button>
          </div>
        }
        @default {
          <label>
            <span>Code from the other machine</span>
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              placeholder="K7Q-4MX"
              [value]="code()"
              [disabled]="waiting()"
              (input)="setCode($event)"
            />
          </label>
          <div class="hint">On the other machine, open Remote and create a code under This machine.</div>
          @if (waiting()) {
            <div class="status">
              @if (check(); as check) {
                Check that the other machine shows {{ check }}, then allow the pairing there.
              } @else {
                Looking for the other machine…
              }
            </div>
          }
          @if (error(); as error) {
            <div class="failure">{{ error }}</div>
          }
          <div class="form-actions">
            <button type="button" class="button" [disabled]="waiting()" (click)="closed.emit()">
              Cancel
            </button>
            <button type="submit" class="button" [disabled]="waiting() || code().trim() === ''">
              Pair
            </button>
          </div>
        }
      }
    </form>
  `,
  styles: `
    .pair-form {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    label span,
    .hint {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    input {
      min-width: 0;
      background: var(--background-color);
      color: var(--foreground-color);
      border: 1px solid color-mix(in srgb, var(--foreground-color) 20%, transparent);
      border-radius: var(--button-border-radius);
      padding: 0.3rem 0.4rem;
      font: inherit;
      text-transform: uppercase;
    }

    input:focus {
      outline: none;
      border-color: var(--highlight-color);
    }

    .status,
    .failure {
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }

    .failure {
      color: var(--color-red);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
  `,
})
export class RemotePairFormComponent {
  /** Paired or cancelled. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly code = signal("");
  readonly state = signal<PairStep>({ step: "entering" });
  readonly error = signal<string | undefined>(undefined);

  /** While the other machine is asked; there is nothing to cancel it with. */
  readonly waiting = computed(() => this.state().step === "waiting");
  readonly check = computed(() => {
    const state = this.state();
    return state.step === "waiting" ? state.check : undefined;
  });
  readonly pairedName = computed(() => {
    const state = this.state();
    return state.step === "paired" ? state.name : undefined;
  });

  constructor(private readonly pairing: PairingPort) {}

  setCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
    this.error.set(undefined);
  }

  async pair(event: Event): Promise<void> {
    event.preventDefault();
    const code = this.code().trim();
    if (this.waiting() || code === "") return;
    this.error.set(undefined);
    this.state.set({ step: "waiting" });
    try {
      const name = await this.pairing.pairByCode(code, (check) =>
        this.state.set({ step: "waiting", check }),
      );
      this.state.set({ step: "paired", name });
    } catch (error) {
      this.state.set({ step: "entering" });
      this.error.set(failureText(error));
    }
  }
}
