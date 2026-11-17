import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { ToggleSwitchComponent } from "@cogno/shared/ui";

/** A code as people read it: two halves, `K7Q-4MX`. */
function readable(code: string): string {
  const plain = code.replace(/[\s-]/g, "").toUpperCase();
  const half = Math.ceil(plain.length / 2);
  return `${plain.slice(0, half)}-${plain.slice(half)}`;
}

/** What is left, as `4:05`. */
function minutesAndSeconds(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * This machine in the Remote panel: a code for another machine to pair with
 * it, whether paired machines may connect, and where they reach it directly.
 * What runs on this machine its tabs show.
 */
@Component({
  selector: "app-remote-this-machine",
  standalone: true,
  imports: [ToggleSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="this-machine">
      <div class="title">This machine</div>
      @if (state(); as state) {
        @if (state.available) {
          @if (shownCode(); as shown) {
            <div class="code-row">
              <span class="code">{{ shown.code }}</span>
              <span class="left">{{ shown.left }}</span>
              <button type="button" class="button text-button" (click)="cancelCode()">
                Cancel
              </button>
            </div>
            <div class="hint">Enter this code on the other machine under Pair with a code.</div>
          } @else {
            <button
              type="button"
              class="button text-button create"
              [disabled]="creating()"
              (click)="createCode()"
            >
              Create a pairing code
            </button>
          }
          <button type="button" class="accepting" (click)="setAccepting(!state.accepting)">
            <app-toggle-switch [checked]="state.accepting"></app-toggle-switch>
            <span>Accept connections from paired machines</span>
          </button>
          @if (directAddresses(); as addresses) {
            <div class="hint">Other machines reach this one directly at {{ addresses }}</div>
          }
        } @else {
          <div class="failure">{{ state.reason }}</div>
        }
      }
      @if (failure(); as failure) {
        <div class="failure">{{ failure }}</div>
      }
    </section>
  `,
  styles: `
    .this-machine {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 0 4px;
      border-top: 1px solid color-mix(in srgb, var(--foreground-color) 15%, transparent);
    }

    .title {
      font-weight: 600;
    }

    .code-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .code {
      font-family: var(--terminal-font-family, monospace);
      font-size: 1.2rem;
      letter-spacing: 0.08em;
    }

    .left,
    .hint {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    .text-button {
      flex: none;
      padding: 1px 8px;
      font-size: 0.85rem;
    }

    .accepting {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 2px 0;
      cursor: pointer;
      text-align: left;
    }

    .failure {
      color: var(--color-red);
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class RemoteThisMachineComponent {
  readonly state = signal<PairingState | undefined>(undefined);
  /** Why the last thing the user asked for did not work. */
  readonly failure = signal<string | undefined>(undefined);
  readonly creating = signal(false);
  /** Ticks every second, for the time a code has left. */
  private readonly now = signal(Date.now());

  /** The code this machine shows, as long as it is valid, and how long that is. */
  readonly shownCode = computed(() => {
    const state = this.state();
    const code = state?.available ? state.code : undefined;
    const left = code ? code.expiresAt - this.now() : 0;
    if (!code || left <= 0) return undefined;
    return { code: readable(code.code), left: minutesAndSeconds(left) };
  });

  /** Where other machines reach this one directly, when it is reached directly at all. */
  readonly directAddresses = computed(() => {
    const state = this.state();
    return state?.available && state.addresses.length > 0 ? state.addresses.join(", ") : undefined;
  });

  constructor(
    private readonly pairing: PairingPort,
    destroyRef: DestroyRef,
  ) {
    pairing.state$.pipe(takeUntilDestroyed(destroyRef)).subscribe((state) => {
      this.now.set(Date.now());
      this.state.set(state);
    });
    const ticking = setInterval(() => this.now.set(Date.now()), 1000);
    destroyRef.onDestroy(() => clearInterval(ticking));
  }

  async createCode(): Promise<void> {
    this.creating.set(true);
    await this.attempt(() => this.pairing.createCode());
    this.creating.set(false);
  }

  cancelCode(): Promise<void> {
    return this.attempt(() => this.pairing.cancelCode());
  }

  setAccepting(on: boolean): Promise<void> {
    return this.attempt(() => this.pairing.setAccepting(on));
  }

  private async attempt(action: () => Promise<void>): Promise<void> {
    this.failure.set(undefined);
    try {
      await action();
    } catch (error) {
      this.failure.set(messageOf(error));
    }
  }
}
