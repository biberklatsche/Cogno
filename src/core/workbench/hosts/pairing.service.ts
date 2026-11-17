import { DestroyRef, Injectable } from "@angular/core";
import { PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Pairing, PairingStateContract, toHostError } from "@cogno/platform";
import { BehaviorSubject, combineLatest, filter, map, Observable } from "rxjs";

/** What pairing said when it was asked last, or why it could not say. */
type Read =
  | { readonly state: PairingStateContract; readonly at: number }
  | { readonly failure: string };

function toState(read: Read, enableFailure: string | undefined): PairingState {
  if ("failure" in read) return { available: false, reason: read.failure };
  if (enableFailure !== undefined) return { available: false, reason: enableFailure };
  const { accepting, code } = read.state;
  return {
    available: true,
    accepting,
    code: code ? { code: code.code, expiresAt: read.at + code.expiresInSecs * 1000 } : undefined,
  };
}

/**
 * Pairing on this machine, as the workbench knows it: read again whenever
 * the app says it changed. The paired machines are remotes beside the ones
 * of `remote.hosts`, and a name belongs to one remote of either kind.
 */
@Injectable({ providedIn: "root" })
export class PairingService extends PairingPort {
  private readonly read = new BehaviorSubject<Read | undefined>(undefined);
  private readonly enableFailure = new BehaviorSubject<string | undefined>(undefined);
  /** The newest question; an answer to an older one is no news. */
  private reads = 0;

  readonly state$: Observable<PairingState>;
  /** The names of the paired machines; none until they are known. */
  readonly pairedNames$: Observable<readonly string[]>;

  constructor(
    private readonly pairing: Pairing,
    private readonly configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    super();
    this.state$ = combineLatest([
      this.read.pipe(filter((read): read is Read => read !== undefined)),
      this.enableFailure,
    ]).pipe(map(([read, enableFailure]) => toState(read, enableFailure)));
    this.pairedNames$ = this.read.pipe(map(namesOf));
    void pairing
      .onChanged(() => void this.readState())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void this.readState();
  }

  /** The names of the paired machines, as far as they are known. */
  get pairedNames(): readonly string[] {
    return namesOf(this.read.value);
  }

  /** The names of every remote: the ones of `remote.hosts` and the paired machines. */
  remoteNames(): readonly string[] {
    return [...Object.keys(this.configService.config.remote?.hosts ?? {}), ...this.pairedNames];
  }

  async enable(): Promise<void> {
    try {
      await this.pairing.enable();
      this.enableFailure.next(undefined);
    } catch (error) {
      this.enableFailure.next(toHostError(error).message);
    }
  }

  async disable(): Promise<void> {
    this.enableFailure.next(undefined);
    await this.pairing.disable();
  }

  async createCode(): Promise<void> {
    await this.pairing.createCode();
  }

  cancelCode(): Promise<void> {
    return this.pairing.cancelCode();
  }

  setAccepting(on: boolean): Promise<void> {
    return this.pairing.setAccepting(on);
  }

  async pairByCode(code: string, onCheck: (check: string) => void): Promise<string> {
    return (await this.pairing.pair(code, this.remoteNames(), onCheck)).name;
  }

  private async readState(): Promise<void> {
    const question = ++this.reads;
    let read: Read;
    try {
      read = { state: await this.pairing.state(), at: Date.now() };
    } catch (error) {
      read = { failure: toHostError(error).message };
    }
    if (question === this.reads) this.read.next(read);
  }
}

function namesOf(read: Read | undefined): readonly string[] {
  return read && "state" in read ? read.state.machines.map(({ name }) => name) : [];
}
