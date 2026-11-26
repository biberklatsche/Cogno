import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  input,
  output,
  signal,
} from "@angular/core";
import { SignInProvider } from "@cogno/platform";
import { GitSignIns } from "../git-sign-ins.service";

/**
 * Signing in to one origin in the browser: the button, the wait while the
 * browser has it, and - once signed in - the way out again.
 */
@Component({
  selector: "app-git-sign-in",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as signedIn) {
      <div class="line">
        <span>Signed in through Cogno.</span>
        <button type="button" class="button" (click)="signIns.signOut(origin())">Sign out</button>
      </div>
      @if (!signedIn.persistent) {
        <p class="note">
          No system keychain took the sign-in, so it lasts until Cogno exits.
        </p>
      }
    } @else if (waiting()) {
      <div class="line">
        <span>Finish the sign-in in your browser…</span>
        <button type="button" class="button" (click)="signIns.cancel(origin())">Cancel</button>
      </div>
    } @else {
      <div class="line">
        <button type="button" class="button primary" (click)="signIn()">
          Sign in with {{ label() }}
        </button>
      </div>
    }
    @if (failure(); as reason) {
      <p class="note failure">{{ reason }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .line {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .note {
        margin: 0;
        line-height: 1.5;
        font-size: 0.9em;
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-strong), transparent);
      }
      .failure {
        color: var(--error-color, inherit);
      }
    `,
  ],
})
export class GitSignInComponent {
  /** `https://host[:port]`. */
  readonly origin = input.required<string>();
  /** The provider's name on the button. */
  readonly label = input.required<string>();
  readonly provider = input.required<SignInProvider>();
  /** The sign-in is stored; git can be answered. */
  readonly signedIn = output<void>();

  readonly waiting = signal(false);
  readonly failure = signal<string | null>(null);
  readonly status = computed(() => this.signIns.status(this.origin()));

  private gone = false;

  constructor(
    readonly signIns: GitSignIns,
    destroyRef: DestroyRef,
  ) {
    // Whoever closes the dialog backs out: a browser tab finished later must
    // not sign in behind their back.
    destroyRef.onDestroy(() => {
      this.gone = true;
      if (this.waiting()) this.signIns.cancel(this.origin());
    });
  }

  async signIn(): Promise<void> {
    this.failure.set(null);
    this.waiting.set(true);
    const failure = await this.signIns.signIn(this.origin(), this.provider());
    if (this.gone) return;
    this.waiting.set(false);
    this.failure.set(failure);
    if (failure === null) this.signedIn.emit();
  }
}
