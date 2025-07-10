import {Observable, Subject} from 'rxjs';
import {filter} from 'rxjs/operators';

export type CognoEvent = {
  type: string;
}


class EventBusImpl {

  private _eventSubject = new Subject<any>();

  onEvent<T extends CognoEvent>(filterFn: (filter: T) => boolean): Observable<T> {
    return this._eventSubject.pipe(filter(s => filterFn(s)));
  }

  sendEvent<T extends CognoEvent>(event: T) {
    this._eventSubject.next(event);
  }
}

export const EventBus: EventBusImpl = new EventBusImpl();
