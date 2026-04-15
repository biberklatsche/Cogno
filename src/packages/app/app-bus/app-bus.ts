import { Injectable } from "@angular/core";
import { fromEvent, Observable, Subject } from "rxjs";
import { filter, timeout as rxTimeout, take, takeUntil } from "rxjs/operators";
import { AppMessage } from "./messages";

export type BusPath = string[];
export type Phase = "capture" | "target" | "bubble";

function key(path: BusPath) {
  return path.join("/");
}
function buildChain(path: BusPath) {
  return path.map((_, i) => path.slice(0, i + 1));
}

export type MessageBase<T extends string = string, P = unknown> = {
  type: T;
  payload?: P;
  path?: BusPath;

  performed?: boolean;
  defaultPrevented?: boolean;
  propagationStopped?: boolean;
  phase?: Phase;
};

export const validTriggers = ["all", "unconsumed", "performable"] as const;
export type ActionTrigger = (typeof validTriggers)[number];

export type ActionBase<T extends string = string, P = unknown> = MessageBase<T, P> & {
  trigger?: { all: boolean; unconsumed: boolean; performable: boolean };
  args?: string[];
};

export type MessageHandler<M extends MessageBase = MessageBase> = (
  msg: M,
  ctx: { path: BusPath },
) => "handled" | true | undefined;

@Injectable({ providedIn: "root" })
export class AppBus {
  private subjects: Map<string, Subject<AppMessage>> = new Map();

  private subjectFor(path: BusPath): Subject<AppMessage> {
    const k = key(path);
    let s = this.subjects.get(k);
    if (!s) {
      s = new Subject<AppMessage>();
      this.subjects.set(k, s);
    }
    return s;
  }

  public on$<K extends AppMessage["type"]>(opts: {
    path: BusPath;
    type?: K | K[];
    phase?: Phase | Phase[];
  }): Observable<Extract<AppMessage, { type: K }>> {
    const { path, type, phase } = opts;
    const types = type ? (Array.isArray(type) ? type : [type]) : null;
    const phases = phase ? (Array.isArray(phase) ? phase : [phase]) : null;

    return this.subjectFor(path).pipe(
      filter((msg): msg is Extract<AppMessage, { type: K }> => {
        if (types && !types.includes(msg.type as K)) return false;
        if (phases && msg.phase && !phases.includes(msg.phase)) return false;
        return true;
      }),
    );
  }

  public onType$<K extends AppMessage["type"]>(
    type: K,
    opts?: { path?: BusPath; phase?: Phase | Phase[] },
  ): Observable<Extract<AppMessage, { type: K }>> {
    return this.on$<K>({ path: opts?.path ?? ["app"], type, phase: opts?.phase });
  }

  public once$<K extends AppMessage["type"]>(opts: {
    path: BusPath;
    type?: K | K[];
    phase?: Phase | Phase[];
    predicate?: (msg: Extract<AppMessage, { type: K }>) => boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Observable<Extract<AppMessage, { type: K }>> {
    let src = this.on$<K>(opts);
    if (opts.predicate) src = src.pipe(filter(opts.predicate));
    let one = src.pipe(take(1));
    if (opts.timeoutMs != null) one = one.pipe(rxTimeout({ first: opts.timeoutMs }));
    if (opts.signal) {
      const abort$ = fromEvent(opts.signal, "abort").pipe(take(1));
      one = one.pipe(takeUntil(abort$));
    }
    return one;
  }

  public onceType$<K extends AppMessage["type"]>(
    type: K,
    opts?: { path?: BusPath; phase?: Phase | Phase[] },
  ): Observable<Extract<AppMessage, { type: K }>> {
    return this.once$<K>({ path: opts?.path ?? ["app"], type, phase: opts?.phase });
  }

  public publish(msg: AppMessage): {
    propagationStopped: boolean;
    defaultPrevented: boolean;
    performed?: boolean;
  } {
    const path = msg.path ?? ["app"];
    const chain = buildChain(path);

    for (const p of chain.slice(0, -1)) {
      msg.phase = "capture";
      this.subjectFor(p).next(msg);
      if (msg.propagationStopped)
        return {
          propagationStopped: msg.propagationStopped,
          defaultPrevented: msg.defaultPrevented ?? false,
          performed: msg.performed,
        };
    }

    msg.phase = "target";
    this.subjectFor(chain[chain.length - 1]).next(msg);
    if (msg.propagationStopped)
      return {
        propagationStopped: msg.propagationStopped,
        defaultPrevented: msg.defaultPrevented ?? false,
        performed: msg.performed,
      };

    for (const p of [...chain].reverse().slice(1)) {
      msg.phase = "bubble";
      this.subjectFor(p).next(msg);
      if (msg.propagationStopped)
        return {
          propagationStopped: msg.propagationStopped,
          defaultPrevented: msg.defaultPrevented ?? false,
          performed: msg.performed,
        };
    }
    return {
      propagationStopped: msg.propagationStopped ?? false,
      defaultPrevented: msg.defaultPrevented ?? false,
      performed: msg.performed,
    };
  }
}
