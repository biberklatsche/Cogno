import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";
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

  constructor(readonly signIns: GitSignIns) {}

  async signIn(): Promise<void> {
    this.failure.set(null);
    this.waiting.set(true);
    const outcome = await this.signIns.signIn(this.origin(), this.provider());
    this.waiting.set(false);
    if (typeof outcome === "string") {
      this.failure.set(outcome);
      return;
    }
    this.signedIn.emit();
  }
}
