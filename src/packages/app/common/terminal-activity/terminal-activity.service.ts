import { Injectable } from "@angular/core";
import { TerminalId } from "@cogno/core-api";
import { Observable, Subject } from "rxjs";
import { throttleTime } from "rxjs/operators";

const ACTIVITY_THROTTLE_MS = 100;

@Injectable({ providedIn: "root" })
export class TerminalActivityService {
  private readonly subjects = new Map<TerminalId, Subject<void>>();

  emit(terminalId: TerminalId): void {
    this.getSubject(terminalId).next();
  }

  activity$(terminalId: TerminalId): Observable<void> {
    return this.getSubject(terminalId).pipe(throttleTime(ACTIVITY_THROTTLE_MS));
  }

  dispose(terminalId: TerminalId): void {
    this.subjects.get(terminalId)?.complete();
    this.subjects.delete(terminalId);
  }

  private getSubject(terminalId: TerminalId): Subject<void> {
    let subject = this.subjects.get(terminalId);
    if (!subject) {
      subject = new Subject<void>();
      this.subjects.set(terminalId, subject);
    }
    return subject;
  }
}
