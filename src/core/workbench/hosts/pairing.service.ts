import { DestroyRef, Injectable } from "@angular/core";
import { PairingCheck, PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { PairedMachineContract, Pairing, PairingStateContract, toHostError } from "@cogno/platform";
import { BehaviorSubject, combineLatest, filter, map, Observable } from "rxjs";

/** What pairing said when it was asked last, or why it could not say. */
type Read = { readonly state: PairingStateContract } | { readonly failure: string };

function toState(read: Read, enableFailure: string | undefined): PairingState {
  if ("failure" in read) return { available: false, reason: read.failure };
  if (enableFailure !== undefined) return { available: false, reason: enableFailure };
  const { open, nearby } = read.state;
  return { available: true, open, nearby };
}

/**
 * Pairing on this machine, as the workbench knows it: read again whenever
 * the app says it changed. The paired machines are the remotes, and a name
 * belongs to one of them.
 */
@Injectable({ providedIn: "root" })
export class PairingService extends PairingPort {
  private readonly read = new BehaviorSubject<Read | undefined>(undefined);
  private readonly enableFailure = new BehaviorSubject<string | undefined>(undefined);
  private readonly enabled = new BehaviorSubject(false);
  /** The newest question; an answer to an older one is no news. */
  private reads = 0;

  readonly state$: Observable<PairingState>;
  /** Whether this machine's endpoint runs: paired machines can be connected to. */
  readonly enabled$: Observable<boolean> = this.enabled.asObservable();
  /** The paired machines; none until they are known. */
  readonly machines$: Observable<readonly PairedMachineContract[]>;

  constructor(
    private readonly pairing: Pairing,
    destroyRef: DestroyRef,
  ) {
    super();
    this.state$ = combineLatest([
      this.read.pipe(filter((read): read is Read => read !== undefined)),
      this.enableFailure,
    ]).pipe(map(([read, enableFailure]) => toState(read, enableFailure)));
    this.machines$ = this.read.pipe(map(machinesOf));
    void pairing
      .onChanged(() => void this.readState())
      .then((unlisten) => destroyRef.onDestroy(unlisten));
    void this.readState();
  }

  /** The paired machines, as far as they are known. */
  get machines(): readonly PairedMachineContract[] {
    return machinesOf(this.read.value);
  }

  /** What the user calls the paired machine `id`, as far as it is known. */
  nameOf(id: string): string | undefined {
    return this.machines.find((machine) => machine.endpointId === id)?.name;
  }

  /** The names of the paired machines, as far as they are known. */
  get pairedNames(): readonly string[] {
    return this.machines.map(({ name }) => name);
  }

  async enable(): Promise<void> {
    try {
      await this.pairing.enable();
      this.enableFailure.next(undefined);
      this.enabled.next(true);
    } catch (error) {
      this.enableFailure.next(toHostError(error).message);
    }
  }

  async disable(): Promise<void> {
    this.enabled.next(false);
    this.enableFailure.next(undefined);
    await this.pairing.disable();
  }

  setOpen(open: boolean): Promise<void> {
    return this.pairing.setOpen(open);
  }

  async pair(id: string, onCheck: (check: PairingCheck) => void): Promise<string> {
    const paired = await this.pairing.pair(id, (request) =>
      onCheck({
        check: request.check,
        answer: (same) => void this.pairing.answer(request.id, same),
      }),
    );
    return paired.name;
  }

  private async readState(): Promise<void> {
    const question = ++this.reads;
    let read: Read;
    try {
      read = { state: await this.pairing.state() };
    } catch (error) {
      read = { failure: toHostError(error).message };
    }
    if (question === this.reads) this.read.next(read);
  }
}

function machinesOf(read: Read | undefined): readonly PairedMachineContract[] {
  return read && "state" in read ? read.state.machines : [];
}
