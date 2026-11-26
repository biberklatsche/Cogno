import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";
import { ProcessCredentialAnswer } from "@cogno/core/api/command-runner-port";
import { SignInProvider } from "@cogno/platform";
import { DIALOG_DATA, DialogRef } from "@cogno/shared/ui";
import { GitSignInComponent } from "./git-sign-in.component";

export type GitCredentialDialogData = {
  /** `https://host[:port]`, as git asked for it. */
  readonly origin: string;
  readonly host: string;
  /** The provider's name, for the sign-in button. */
  readonly label: string;
  /** How to sign in in the browser; null where only a token works. */
  readonly provider: SignInProvider | null;
  /** What to create and enter as the password; one sentence, no trailing period. */
  readonly token: string;
};

/** The answer for git, or `"other"`: the person wants to see the other ways in. */
export type GitCredentialDialogResult = ProcessCredentialAnswer | "other";

/**
 * Git needs credentials for a host and no helper had any. One click signs in
 * in the browser where Cogno can; a name and a token typed here go to git as
 * they are. Dismissing refuses the request, and git fails without asking on.
 */
@Component({
  selector: "app-git-credential-dialog",
  standalone: true,
  imports: [GitSignInComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="credential">
      @if (data.provider; as provider) {
        <app-git-sign-in
          [origin]="data.origin"
          [label]="data.label"
          [provider]="provider"
          (signedIn)="dialogRef.close({ kind: 'signed_in' })"
        ></app-git-sign-in>
        <p class="or">or enter a token</p>
      }
      <form class="typed" (submit)="$event.preventDefault(); useTyped()">
        <p class="hint">{{ data.token }}. {{ data.host }} takes it in place of a password.</p>
        <label>
          <span>Username</span>
          <input
            #username
            class="field"
            type="text"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            [value]="name()"
            (input)="name.set(username.value)"
          />
        </label>
        <label>
          <span>Token</span>
          <input
            #password
            class="field"
            type="password"
            autocomplete="off"
            [value]="secret()"
            (input)="secret.set(password.value)"
          />
        </label>
        <div class="actions">
          <button type="button" class="button" (click)="dialogRef.close('other')">Other ways…</button>
          <span class="spacer"></span>
          <button type="button" class="button" (click)="dialogRef.close()">Cancel</button>
          <button type="submit" class="button" [class.primary]="!data.provider" [disabled]="!secret()">
            Use token
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .credential,
      .typed {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .credential {
        min-width: min(28rem, calc(100vw - 2rem));
      }
      .or,
      .hint {
        margin: 0;
        line-height: 1.5;
      }
      .or {
        padding-top: 0.75rem;
        border-top: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        color: color-mix(in srgb, var(--foreground-color) var(--opacity-strong), transparent);
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .field {
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: var(--button-border-radius);
        padding: 0.4rem 0.5rem;
        font: inherit;
      }
      .field:focus {
        outline: none;
        border-color: var(--highlight-color);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .spacer {
        flex: 1;
      }
    `,
  ],
})
export class GitCredentialDialogComponent {
  readonly name = signal("");
  readonly secret = signal("");

  constructor(
    readonly dialogRef: DialogRef<GitCredentialDialogResult>,
    @Inject(DIALOG_DATA) readonly data: GitCredentialDialogData,
  ) {}

  useTyped(): void {
    if (!this.secret()) return;
    this.dialogRef.close({
      kind: "typed",
      username: this.name().trim(),
      password: this.secret(),
    });
  }
}
