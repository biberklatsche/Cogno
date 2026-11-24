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
import { isHostError } from "@cogno/platform";

/** How far pairing is: choosing a machine, comparing the number, waiting for the other, done. */
type PairStep =
  | { readonly step: "choosing" }
  | { readonly step: "asking"; readonly machine: NearbyMachine }
  | { readonly step: "comparing"; readonly machine: NearbyMachine; readonly check: PairingCheck }
  | { readonly step: "confirmed"; readonly machine: NearbyMachine }
  | { readonly step: "paired"; readonly name: string };

/** Why pairing did not work, in words for the user. */
function failureText(error: unknown): string {
  if (isHostError(error, "pairingDeclined")) {
    return "Not paired: it was not confirmed on both machines. Pairing has to be open there too.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pairs this machine with one nearby. Pairing is open while this is shown:
 * this machine is seen by the others that have it open, and sees them. The
 * user picks one, compares the number both show, and confirms it on both.
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
            <div class="status">Paired with {{ pairedName() }}.</div>
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
              Open this on the other machine too. Both have to be in the same network.
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
  readonly machineName = computed(() => {
    const state = this.state();
    return "machine" in state ? state.machine.name : undefined;
  });
  readonly check = computed(() => {
    const state = this.state();
    return state.step === "comparing" ? state.check.check : undefined;
  });
  readonly pairedName = computed(() => {
    const state = this.state();
    return state.step === "paired" ? state.name : undefined;
  });

  constructor(
    private readonly pairing: PairingPort,
    destroyRef: DestroyRef,
  ) {
    pairing.state$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((state) => this.pairingState.set(state));
    // Open for as long as this is shown, and no longer.
    this.setOpen(true);
    destroyRef.onDestroy(() => this.setOpen(false));
  }

  private setOpen(open: boolean): void {
    this.pairing.setOpen(open).catch((error) => {
      if (open) this.error.set(failureText(error));
    });
  }

  async pair(machine: NearbyMachine): Promise<void> {
    if (this.state().step !== "choosing") return;
    this.error.set(undefined);
    this.state.set({ step: "asking", machine });
    try {
      const name = await this.pairing.pair(machine.id, (check) =>
        this.state.set({ step: "comparing", machine, check }),
      );
      this.state.set({ step: "paired", name });
    } catch (error) {
      this.state.set({ step: "choosing" });
      this.error.set(failureText(error));
    }
  }

  /** The user compared the number both machines show. */
  answer(same: boolean): void {
    const state = this.state();
    if (state.step !== "comparing") return;
    state.check.answer(same);
    if (same) this.state.set({ step: "confirmed", machine: state.machine });
  }
}
