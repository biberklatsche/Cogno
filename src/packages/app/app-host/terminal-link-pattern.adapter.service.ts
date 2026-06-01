import { DestroyRef, Injectable } from "@angular/core";
import { TerminalLinkPatternPort } from "@cogno/core-api";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class TerminalLinkPatternAdapterService extends TerminalLinkPatternPort {
  private readonly subjects = new Map<string, BehaviorSubject<string | undefined>>();

  constructor(destroyRef: DestroyRef) {
    super();
    destroyRef.onDestroy(() => {
      for (const subject of this.subjects.values()) subject.complete();
      this.subjects.clear();
    });
  }

  pattern$(terminalId: string): Observable<string | undefined> {
    return this.subjectFor(terminalId).asObservable();
  }

  setPattern(terminalId: string, pattern: string): void {
    this.subjectFor(terminalId).next(pattern);
  }

  clearPattern(terminalId: string): void {
    const s = this.subjects.get(terminalId);
    if (s) {
      s.next(undefined);
      s.complete();
      this.subjects.delete(terminalId);
    }
  }

  private subjectFor(terminalId: string): BehaviorSubject<string | undefined> {
    let s = this.subjects.get(terminalId);
    if (!s) {
      s = new BehaviorSubject<string | undefined>(undefined);
      this.subjects.set(terminalId, s);
    }
    return s;
  }
}
