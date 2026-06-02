import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ICodingAgentProvider, TerminalMonitorPort, TerminalProcessPort } from "@cogno/core-api";
import { debounceTime, filter, Observable, Subject } from "rxjs";
import { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";

const DETECTION_DEBOUNCE_MS = 2000;

export type AgentDetectedEvent = { terminalId: string; provider: ICodingAgentProvider };

@Injectable({ providedIn: "root" })
export class CodingAgentDetectionService {
  private readonly _detected$ = new Subject<AgentDetectedEvent>();
  readonly detected$: Observable<AgentDetectedEvent> = this._detected$.asObservable();

  // Prevents repeated OS process-tree scans for the same terminal.
  private readonly scannedTerminals = new Set<string>();

  constructor(
    monitor: TerminalMonitorPort,
    private readonly registry: CodingAgentProviderRegistry,
    private readonly processPort: TerminalProcessPort,
    destroyRef: DestroyRef,
  ) {
    monitor.activity$
      .pipe(
        filter((e) => e.isBusy),
        debounceTime(DETECTION_DEBOUNCE_MS),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((event) => void this.scan(event.terminalId));

    monitor.activity$
      .pipe(
        filter((e) => !e.isBusy),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((e) => this.scannedTerminals.delete(e.terminalId));

    monitor.terminated$.pipe(takeUntilDestroyed(destroyRef)).subscribe((terminalId) => {
      this.scannedTerminals.delete(terminalId);
    });
  }

  private async scan(terminalId: string): Promise<void> {
    if (this.scannedTerminals.has(terminalId)) return;
    this.scannedTerminals.add(terminalId);

    let descendantNames: ReadonlySet<string>;
    try {
      descendantNames = await this.processPort.getDescendantProcessNames(terminalId);
      console.log(`Scanned terminal ${terminalId} for coding agents`, descendantNames);
    } catch {
      console.error(`Failed to scan terminal ${terminalId} for coding agents`);
      return;
    }

    for (const provider of this.registry.providers) {
      const detected = provider.processNames.some((name) =>
        descendantNames.has(name.toLowerCase()),
      );
      if (detected) {
        this._detected$.next({ terminalId, provider });
        break;
      }
    }
  }
}
