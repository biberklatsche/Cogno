import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PairingCheck, PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config } from "@cogno/core/infrastructure/config/models/config";
import { NO_RELAY } from "@cogno/core/infrastructure/config/models/remote-config";
import { PairedMachineContract, Pairing, PairingStateContract, toHostError } from "@cogno/platform";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  skip,
} from "rxjs";

/** What pairing said when it was asked last, or why it could not say. */
type Read = { readonly state: PairingStateContract } | { readonly failure: string };

function toState(read: Read, enableFailure: string | undefined): PairingState {
  if ("failure" in read) return { available: false, reason: read.failure };
  if (enableFailure !== undefined) return { available: false, reason: enableFailure };
  const { open, nearby, invitation } = read.state;
  return { available: true, open, nearby, invitation: invitation ?? undefined };
}

/**
 * Pairing on this machine, as the workbench knows it: read again whenever
 * the app says it changed. The paired machines are the remotes.
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
    private readonly configService: ConfigService,
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
    // Another relay: the app starts the endpoint again with it, once,
    // however many windows ask.
    this.configService.config$
      .pipe(map(relayOf), distinctUntilChanged(), skip(1), takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.enabled.value) void this.enable();
      });
  }

  /** The paired machines, as far as they are known. */
  get machines(): readonly PairedMachineContract[] {
    return machinesOf(this.read.value);
  }

  /** What to call the machine `id` towards the user: its name, as far as it is known. */
  labelOf(id: string): string {
    return this.nameOf(id) ?? "the other machine";
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
      await this.pairing.enable(relayOf(this.configService.config));
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
        name: request.name ?? undefined,
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

/** The relay the config names; none when it is switched off. */
function relayOf(config: Config): string | null {
  const relay = config.remote?.relay;
  return relay === undefined || relay === NO_RELAY ? null : relay;
}

function machinesOf(read: Read | undefined): readonly PairedMachineContract[] {
  return read && "state" in read ? read.state.machines : [];
}
