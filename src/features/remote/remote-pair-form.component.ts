import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  Output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  NearbyMachine,
  PairingCheck,
  PairingPort,
  PairingState,
} from "@cogno/core/api/pairing-port";
import { ClipboardAccess, isHostError } from "@cogno/platform";

/**
 * How far pairing is: choosing a machine, comparing the number, waiting for
 * the other, done. `name` is what the other machine is called, once known:
 * one that was invited says it only when it is asked.
 */
type PairStep =
  | { readonly step: "choosing" }
  | { readonly step: "asking"; readonly name?: string }
  | { readonly step: "comparing"; readonly name?: string; readonly check: PairingCheck }
  | { readonly step: "confirmed"; readonly name?: string }
  | { readonly step: "paired"; readonly name: string };

/** How long "Copied" stands on the button. */
const COPIED_SHOWN_FOR_MS = 2000;

/** Why pairing did not work, in words for the user. */
function failureText(error: unknown): string {
  if (isHostError(error, "pairingDeclined")) {
    return "Not paired: it was not confirmed on both machines. Pairing has to be open there too.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pairs this machine with another one. Pairing is open while this is shown:
 * this machine is seen by the others nearby that have it open, and sees
 * them. The user picks one - or, for a machine in another network, pastes
 * the invitation that one shows - compares the number both show, and
 * confirms it on both.
 */
@Component({
  selector: "app-remote-pair-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pair-form">
      <div class="title">Pair with a machine</div>
      @if (unavailable(); as reason) {
        <div class="failure">{{ reason }}</div>
      } @else {
        @switch (state().step) {
          @case ("paired") {
            <div class="status">Paired with {{ machineName() }}.</div>
          }
          @case ("comparing") {
            <div class="status">Does {{ machineName() }} show this number?</div>
            <div class="check">{{ check() }}</div>
            <div class="form-actions">
              <button type="button" class="button" (click)="answer(false)">No</button>
              <button type="button" class="button" (click)="answer(true)">They match</button>
            </div>
          }
          @case ("confirmed") {
            <div class="status">Confirm the number on {{ machineName() }} too…</div>
          }
          @case ("asking") {
            <div class="status">Asking {{ machineName() }}…</div>
          }
          @default {
            <div class="hint">
              Open this on the other machine too. A machine in the same network is listed here.
            </div>
            @for (machine of nearby(); track machine.id) {
              <div class="machine">
                <span class="name">{{ machine.name }}</span>
                <button type="button" class="button text-button" (click)="pair(machine)">
                  Pair
                </button>
              </div>
            } @empty {
              <div class="status">Looking for machines nearby…</div>
            }
            @if (invitation(); as invitation) {
              <div class="other-network">
                <div class="hint">
                  In another network: send this machine's invitation to the other one, or paste
                  the one it sent you. Open this there too.
                </div>
                <div class="machine">
                  <span class="name invitation">{{ invitation }}</span>
                  <button type="button" class="button text-button" (click)="copyInvitation()">
                    {{ copied() ? "Copied" : "Copy" }}
                  </button>
                </div>
                <form class="machine" (submit)="pairByInvitation($event)">
                  <input
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="Paste an invitation"
                    [value]="pasted()"
                    (input)="setPasted($event)"
                  />
                  <button type="submit" class="button text-button" [disabled]="pasted().trim() === ''">
                    Pair
                  </button>
                </form>
              </div>
            }
          }
        }
      }
      @if (error(); as error) {
        <div class="failure">{{ error }}</div>
      }
      @if (state().step === "choosing" || state().step === "paired") {
        <div class="form-actions">
          <button type="button" class="button" (click)="closed.emit()">Done</button>
        </div>
      }
    </section>
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

    .title {
      font-weight: 600;
    }

    .hint {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .machine {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .other-network {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 6px;
      border-top: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    .invitation {
      font-family: var(--terminal-font-family, monospace);
      font-size: 0.85rem;
      opacity: 0.7;
    }

    input {
      flex: 1;
      min-width: 0;
      background: var(--background-color);
      color: var(--foreground-color);
      border: 1px solid color-mix(in srgb, var(--foreground-color) 20%, transparent);
      border-radius: var(--button-border-radius);
      padding: 0.3rem 0.4rem;
      font: inherit;
    }

    input:focus {
      outline: none;
      border-color: var(--highlight-color);
    }

    .check {
      font-family: var(--terminal-font-family, monospace);
      font-size: 1.4rem;
      letter-spacing: 0.12em;
    }

    .text-button {
      flex: none;
      padding: 1px 8px;
      font-size: 0.85rem;
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
  /** Paired or given up. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly state = signal<PairStep>({ step: "choosing" });
  readonly error = signal<string | undefined>(undefined);
  /** The invitation of another machine the user is pasting. */
  readonly pasted = signal("");
  /** Whether this machine's invitation was just copied. */
  readonly copied = signal(false);
  private copiedShown?: ReturnType<typeof setTimeout>;
  private readonly pairingState = signal<PairingState | undefined>(undefined);

  /** Why pairing does not work on this machine at all. */
  readonly unavailable = computed(() => {
    const state = this.pairingState();
    return state?.available === false ? state.reason : undefined;
  });
  /** The machines nearby that have pairing open too. */
  readonly nearby = computed(() => {
    const state = this.pairingState();
    return state?.available ? state.nearby : [];
  });
  /** What to give someone in another network; none when only this network is reached. */
  readonly invitation = computed(() => {
    const state = this.pairingState();
    return state?.available ? state.invitation : undefined;
  });
  /** What the machine being paired with is called. */
  readonly machineName = computed(() => {
    const state = this.state();
    return ("name" in state ? state.name : undefined) ?? "the other machine";
  });
  readonly check = computed(() => {
    const state = this.state();
    return state.step === "comparing" ? state.check.check : undefined;
  });

  constructor(
    private readonly pairing: PairingPort,
    private readonly clipboard: ClipboardAccess,
    destroyRef: DestroyRef,
  ) {
    pairing.state$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((state) => this.pairingState.set(state));
    // Open for as long as this is shown, and no longer.
    this.setOpen(true);
    destroyRef.onDestroy(() => {
      this.setOpen(false);
      clearTimeout(this.copiedShown);
    });
  }

  private setOpen(open: boolean): void {
    this.pairing.setOpen(open).catch((error) => {
      if (open) this.error.set(failureText(error));
    });
  }

  /** Pairs with a machine nearby. */
  pair(machine: NearbyMachine): Promise<void> {
    return this.ask(machine.id, machine.name);
  }

  /** Asks the machine `id` to pair; `name` is what it is called, where known. */
  private async ask(id: string, name?: string): Promise<void> {
    if (this.state().step !== "choosing") return;
    this.error.set(undefined);
    this.state.set({ step: "asking", name });
    try {
      const paired = await this.pairing.pair(id, (check) =>
        this.state.set({ step: "comparing", name: name ?? check.name, check }),
      );
      this.state.set({ step: "paired", name: paired });
    } catch (error) {
      this.state.set({ step: "choosing" });
      this.error.set(failureText(error));
    }
  }

  setPasted(event: Event): void {
    this.pasted.set((event.target as HTMLInputElement).value);
    this.error.set(undefined);
  }

  async copyInvitation(): Promise<void> {
    const invitation = this.invitation();
    if (!invitation) return;
    await this.clipboard.writeText(invitation);
    this.copied.set(true);
    clearTimeout(this.copiedShown);
    this.copiedShown = setTimeout(() => this.copied.set(false), COPIED_SHOWN_FOR_MS);
  }

  /** Pairs with the machine whose invitation the user pasted. */
  async pairByInvitation(event: Event): Promise<void> {
    event.preventDefault();
    const invitation = this.pasted().trim();
    if (invitation === "") return;
    // Whether it is one, the app says.
    await this.ask(invitation);
    if (this.state().step === "paired") this.pasted.set("");
  }

  /** The user compared the number both machines show. */
  answer(same: boolean): void {
    const state = this.state();
    if (state.step !== "comparing") return;
    state.check.answer(same);
    if (same) this.state.set({ step: "confirmed", name: state.name });
  }
}
