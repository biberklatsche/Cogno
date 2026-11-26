import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { SignInProvider, SignInStatus, SignIns } from "@cogno/platform";

/**
 * The sign-ins Cogno holds, as the git feature shows them. The backend owns
 * them (ARCHITECTURE.md 2.1, "Anmeldungen"); this keeps the list current for
 * the dialogs and passes their requests on.
 */
@Injectable({ providedIn: "root" })
export class GitSignIns {
  private readonly statusesSignal = signal<ReadonlyArray<SignInStatus>>([]);
  readonly statuses: Signal<ReadonlyArray<SignInStatus>> = this.statusesSignal.asReadonly();

  constructor(
    private readonly signIns: SignIns,
    destroyRef: DestroyRef,
  ) {
    void signIns
      .onChanged((statuses) => this.statusesSignal.set(statuses))
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void signIns.list().then(
      (statuses) => this.statusesSignal.set(statuses),
      () => undefined,
    );
  }

  status(origin: string): SignInStatus | null {
    return this.statuses().find((status) => status.origin === origin) ?? null;
  }

  /** Opens the browser; the reason as text when the sign-in did not happen. */
  async signIn(origin: string, provider: SignInProvider): Promise<SignInStatus | string> {
    try {
      return await this.signIns.signIn(origin, provider);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  cancel(origin: string): void {
    void this.signIns.cancel(origin);
  }

  signOut(origin: string): void {
    void this.signIns.signOut(origin);
  }
}
