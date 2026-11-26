import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * What a sign-in needs to know about its provider: where the browser goes,
 * where the code is exchanged, and as which client. Whoever offers the
 * sign-in names it; the backend keeps it with the sign-in.
 */
export interface SignInProvider {
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  /** Only where the provider demands one from a desktop app; public then. */
  readonly clientSecret?: string;
  readonly scopes: ReadonlyArray<string>;
  /** The name git sends next to the token. */
  readonly username: string;
}

export interface SignInStatus {
  /** `https://host[:port]`. */
  readonly origin: string;
  /** Kept in the system keychain; false when it lasts only until Cogno exits. */
  readonly persistent: boolean;
}

/**
 * Sign-ins the backend holds: made in the browser, stored in the system
 * keychain, handed to git by the backend itself. A window learns that an
 * origin is signed in, never a token.
 */
@Injectable({ providedIn: "root" })
export class SignIns {
  /** Opens the browser and resolves once the tokens are stored; rejects with the reason otherwise. */
  signIn(origin: string, provider: SignInProvider): Promise<SignInStatus> {
    return invoke<SignInStatus>("sign_ins_sign_in", { origin, provider });
  }

  /** Ends a sign-in that still waits for the browser; its `signIn` rejects. */
  cancel(origin: string): Promise<void> {
    return invoke<void>("sign_ins_cancel", { origin });
  }

  signOut(origin: string): Promise<void> {
    return invoke<void>("sign_ins_sign_out", { origin });
  }

  list(): Promise<ReadonlyArray<SignInStatus>> {
    return invoke<SignInStatus[]>("sign_ins_list");
  }

  /** The list changed: a sign-in, a sign-out, or a token that could not be renewed. */
  onChanged(listener: (statuses: ReadonlyArray<SignInStatus>) => void): Promise<UnlistenFn> {
    return listen<SignInStatus[]>("sign-ins-changed", ({ payload }) => listener(payload));
  }
}
