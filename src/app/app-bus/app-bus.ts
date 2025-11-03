import { Injectable } from "@angular/core";
import { Observable, Subject, firstValueFrom, fromEvent, race } from "rxjs";
import { filter, take, timeout as rxTimeout } from "rxjs/operators";
import {AppMessage} from "./messages";

// ---------------------------------------------------------
// Basics
// ---------------------------------------------------------
export type BusPath = string[];
export type Phase = "capture" | "target" | "bubble";

function key(path: BusPath) { return path.join("/"); }
function buildChain(path: BusPath) { return path.map((_, i) => path.slice(0, i + 1)); }

// ---------------------------------------------------------
// Gemeinsames Message-Modell (Events + Actions)
// ---------------------------------------------------------
export type MessageBase<T extends string = string, P = unknown> = {
    type: T;
    payload?: P;
    path?: BusPath;     // default ["app"]

    // Optional vorhandene Event-Flags (bei Actions i.d.R. ungenutzt)
    defaultPrevented?: boolean;
    propagationStopped?: boolean;
    phase?: Phase;
}

export const validTriggers = ['all', 'unconsumed', 'performable'] as const;
export type ActionTrigger = typeof validTriggers[number];

export type ActionBase<T extends string = string, P = unknown> = MessageBase<T, P> & {
    trigger?: {all: boolean, unconsumed: boolean, performable: boolean};
    args?: string[];
}

// Einheitlicher Handler: kann kurzschließen (Command-Style)
export type MessageHandler<M extends MessageBase = MessageBase> =
    (msg: M, ctx: { path: BusPath }) => "handled" | true | void;

// ---------------------------------------------------------
// Ein Bus für alles
// ---------------------------------------------------------
@Injectable({ providedIn: "root" })
export class AppBus {
    // Subjects je Pfad
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

    // Reaktives Abo (optional nach Typ/Phase filtern)
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
            })
        );
    }

    public onType$<K extends AppMessage["type"]>(
        type: K,
        opts?: { path?: BusPath; phase?: Phase | Phase[] }
    ): Observable<Extract<AppMessage, { type: K }>> {
        return this.on$<K>({ path: opts?.path ?? ["app"], type, phase: opts?.phase });
    }

    // One-shot Observable / Promise
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
            // @ts-ignore rxjs race array
            one = race(one, abort$) as any;
        }
        return one;
    }

    public onceType$<K extends AppMessage["type"]>(
        type: K,
        opts?: { path?: BusPath; phase?: Phase | Phase[] }
    ): Observable<Extract<AppMessage, { type: K }>> {
        return this.once$<K>({ path: opts?.path ?? ["app"], type, phase: opts?.phase });
    }

    /**
     * publish:
     * - führt entlang Pfadkette (capture → target → bubble) aus
     * - bricht ab, wenn:
     *   * bei vorhandenen Event-Flags defaultPrevented oder propagationStopped gesetzt wird
     */
    public publish(msg: AppMessage): boolean {
        const path = msg.path ?? ["app"];
        const chain = buildChain(path);

        // capture
        for (const p of chain.slice(0, -1)) {
            msg.phase = "capture";
            this.subjectFor(p).next(msg);
            if (msg.defaultPrevented || msg.propagationStopped) return true;
        }

        // target
        msg.phase = "target";
        this.subjectFor(chain[chain.length - 1]).next(msg);
        if (msg.defaultPrevented || msg.propagationStopped) return true;

        // bubble
        for (const p of [...chain].reverse().slice(1)){
            msg.phase = "bubble";
            this.subjectFor(p).next(msg);
            if (msg.defaultPrevented || msg.propagationStopped) return true;
        }

        return false;
    }
}
