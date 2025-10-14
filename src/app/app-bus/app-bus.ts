import { Injectable } from "@angular/core";
import { Observable, firstValueFrom, fromEvent, race } from "rxjs";
import { filter, take, timeout as rxTimeout } from "rxjs/operators";
import {AppMessage} from "./messages";

// ---------------------------------------------------------
// Basics
// ---------------------------------------------------------
export type BusPath = string[];
export type Phase = "capture" | "target" | "bubble";
type MapArray<T> = Map<string, T[]>;

function key(path: BusPath) { return path.join("/"); }
function buildChain(path: BusPath) { return path.map((_, i) => path.slice(0, i + 1)); }

// ---------------------------------------------------------
// Gemeinsames Message-Modell (Events + Commands)
// ---------------------------------------------------------
export type MessageBase<T extends string = string, P = unknown> = {
    type: T;
    payload?: P;
    targetPath?: BusPath;     // default ["app"]
    timestamp?: number;
    sourcePath?: BusPath;
    correlationId?: string;

    // Optional vorhandene Event-Flags (bei Commands i.d.R. ungenutzt)
    cancelable?: boolean;
    defaultPrevented?: boolean;
    propagationStopped?: boolean;
    phase?: Phase;
};

// Hilfsfunktionen für Event-Style-Flags
export const preventDefaultMessage = (msg: MessageBase<any, unknown>) =>
    (msg.cancelable = msg.defaultPrevented = true);

export const stopPropagationMessage = (msg: MessageBase<any, unknown>) =>
    (msg.propagationStopped = true);

// Einheitlicher Handler: kann kurzschließen (Command-Style)
export type MessageHandler<M extends AppMessage = AppMessage> =
    (msg: M, ctx: { path: BusPath }) => "handled" | true | void;

// ---------------------------------------------------------
// Ein Bus für alles
// ---------------------------------------------------------
@Injectable({ providedIn: "root" })
export class AppBus {
    private tree: MapArray<MessageHandler> = new Map();

    // Abo per Callback
    public on(path: BusPath, handler: MessageHandler) {
        const k = key(path);
        const arr = this.tree.get(k) ?? [];
        arr.push(handler);
        this.tree.set(k, arr);
    }

    public off(path: BusPath, handler: MessageHandler) {
        const k = key(path);
        const arr = this.tree.get(k);
        if (!arr) return;
        const next = arr.filter(h => h !== handler);
        next.length ? this.tree.set(k, next) : this.tree.delete(k);
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

        return new Observable<Extract<AppMessage, { type: K }>>(subscriber => {
            const handler: MessageHandler = (msg) => {
                if (types && !types.includes(msg.type as K)) return;
                if (phases && msg.phase && !phases.includes(msg.phase)) return; // Phase ist optional
                subscriber.next(msg as Extract<AppMessage, { type: K }>);
            };
            this.on(path, handler);
            return () => this.off(path, handler);
        });
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

    public waitForOnce<K extends AppMessage["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        phase?: Phase | Phase[];
        predicate?: (msg: Extract<AppMessage, { type: K }>) => boolean;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<Extract<AppMessage, { type: K }>> {
        return firstValueFrom(this.once$<K>(opts));
    }

    /**
     * publish:
     * - führt entlang Pfadkette (capture → target → bubble) aus
     * - bricht ab, wenn:
     *   * ein Handler "handled"/true zurückgibt (Command-Style), ODER
     *   * bei vorhandenen Event-Flags cancelable+defaultPrevented oder propagationStopped gesetzt wird
     */
    public publish(msg: AppMessage): boolean {
        const path = msg.targetPath ?? ["app"];
        const chain = buildChain(path);

        // capture
        for (const p of chain.slice(0, -1))
            if (this.dispatch(msg, p, "capture")) return true;

        // target
        if (this.dispatch(msg, chain[chain.length - 1], "target")) return true;

        // bubble
        for (const p of [...chain].reverse().slice(1))
            if (this.dispatch(msg, p, "bubble")) return true;

        return false;
    }

    private dispatch(msg: AppMessage, path: BusPath, phase: Phase): boolean {
        const handlers = this.tree.get(key(path)) ?? [];
        for (const h of handlers) {
            // Klonen, damit Handler Flags toggeln dürfen
            const clone: AppMessage = { ...(msg as any), phase };

            const res = h(clone, { path });

            // Flags zurückspiegeln (nur wenn vorhanden)
            if ("cancelable" in clone) (msg as any).cancelable = clone.cancelable;
            if ("defaultPrevented" in clone) (msg as any).defaultPrevented = clone.defaultPrevented;
            if ("propagationStopped" in clone) (msg as any).propagationStopped = clone.propagationStopped;

            // Kurzschluss: Command-Style
            if (res === "handled" || res === true) return true;

            // Kurzschluss: Event-Style
            if ((msg as any).cancelable && (msg as any).defaultPrevented) return true;
            if ((msg as any).propagationStopped) return true;
        }
        return false;
    }
}
