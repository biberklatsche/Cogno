import { Injectable } from "@angular/core";
import { Observable, firstValueFrom, fromEvent, race } from "rxjs";
import { filter, take, timeout as rxTimeout } from "rxjs/operators";
import {
    ConfigLoadedEvent,
    LoadConfigCommand,
    ThemeChangedEvent, WatchConfigCommand
} from "../config/+bus/events";

// ---------------------------------------------------------
// Gemeinsame Basics
// ---------------------------------------------------------
export type BusPath = string[];
export type Phase = "capture" | "target" | "bubble";

type MapArray<T> = Map<string, T[]>;

function key(path: BusPath) { return path.join("/"); }
function buildChain(path: BusPath) { return path.map((_, i) => path.slice(0, i + 1)); }

// ---------------------------------------------------------
// EVENTS
// ---------------------------------------------------------
export type EventBase<T extends string = string, P = unknown> = {
    type: T;
    payload?: P;
    targetPath?: BusPath;   // default ["app"]
    // Browser-ähnliche Semantik:
    cancelable?: boolean;
    defaultPrevented?: boolean;
    propagationStopped?: boolean;
    phase?: Phase;
    timestamp?: number;
    sourcePath?: BusPath;
    correlationId?: string;
};

export type EventHandler<E extends AppEvent = AppEvent> =
    (ev: E, ctx: { path: BusPath }) => void;

export type AppEvent = ConfigLoadedEvent | ThemeChangedEvent;

export const preventDefaultEvent = (ev: EventBase<any, unknown>) =>
    (ev.cancelable = ev.defaultPrevented = true);

export const stopPropagationEvent = (ev: EventBase<any, unknown>) =>
    (ev.propagationStopped = true);

@Injectable({ providedIn: "root" })
export class EventBus {
    private tree: MapArray<EventHandler> = new Map();

    public on(path: BusPath, handler: EventHandler) {
        const arr = this.tree.get(key(path)) ?? [];
        arr.push(handler);
        this.tree.set(key(path), arr);
    }
    public off(path: BusPath, handler: EventHandler) {
        const k = key(path);
        const arr = this.tree.get(k);
        if (!arr) return;
        const next = arr.filter(h => h !== handler);
        next.length ? this.tree.set(k, next) : this.tree.delete(k);
    }

    /** Reaktives Abo */
    public on$<K extends AppEvent["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        phase?: Phase | Phase[];
    }): Observable<Extract<AppEvent, { type: K }>> {
        const { path, type, phase } = opts;
        const types = type ? (Array.isArray(type) ? type : [type]) : null;
        const phases = phase ? (Array.isArray(phase) ? phase : [phase]) : null;

        return new Observable<Extract<AppEvent, { type: K }>>(subscriber => {
            const handler: EventHandler = (ev, ctx) => {
                if (types && !types.includes(ev.type as K)) return;
                if (phases && !phases.includes(ev.phase!)) return;
                subscriber.next(ev as Extract<AppEvent, { type: K }>);
            };
            this.on(path, handler);
            return () => this.off(path, handler);
        });
    }

    public onType$<K extends AppEvent["type"]>(
        type: K,
        opts?: { path?: BusPath; phase?: Phase | Phase[] }
    ): Observable<Extract<AppEvent, { type: K }>> {
        return this.on$<K>({
            path: opts?.path ?? ["app"],
            type,
            phase: opts?.phase,
        });
    }

    /** One-shot Observable */
    public once$<K extends AppEvent["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        phase?: Phase | Phase[];
        predicate?: (ev: Extract<AppEvent, { type: K }>) => boolean;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Observable<Extract<AppEvent, { type: K }>> {
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

    /** Promise-Variante */
    public waitForOnce<K extends AppEvent["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        phase?: Phase | Phase[];
        predicate?: (ev: Extract<AppEvent, { type: K }>) => boolean;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<Extract<AppEvent, { type: K }>> {
        return firstValueFrom(this.once$<K>(opts));
    }

    /** Dispatch: unterstützt stopPropagation/preventDefault */
    public emit(ev: AppEvent) {
        const path = ev.targetPath ?? ["app"];
        const chain = buildChain(path);

        // capture
        for (const p of chain.slice(0, -1))
            if (this.dispatch(ev, p, "capture")) break;

        // target
        if (!ev.propagationStopped)
            this.dispatch(ev, chain[chain.length - 1], "target");

        // bubble
        for (const p of [...chain].reverse().slice(1))
            if (this.dispatch(ev, p, "bubble")) break;
    }

    private dispatch(ev: AppEvent, path: BusPath, phase: Phase): boolean {
        const handlers = this.tree.get(key(path)) ?? [];
        for (const h of handlers) {
            // Klonen, damit Observable-Handler Flags toggeln können
            const clone: AppEvent = { ...ev, phase };
            h(clone, { path });
            // Flags zurückspiegeln
            if (clone.cancelable !== ev.cancelable) ev.cancelable = clone.cancelable;
            if (clone.defaultPrevented !== ev.defaultPrevented) ev.defaultPrevented = clone.defaultPrevented;
            if (clone.propagationStopped !== ev.propagationStopped) ev.propagationStopped = clone.propagationStopped;

            if (ev.cancelable && ev.defaultPrevented) return true;
            if (ev.propagationStopped) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------
// COMMANDS
// ---------------------------------------------------------
export type CommandBase<T extends string = string, P = unknown> = {
    type: T;
    payload?: P;
    targetPath?: BusPath;   // default ["app"]
    // Hinweis: keine propagationFlags – Commands werden nur kurzgeschlossen, wenn "handled" zurückkommt
    timestamp?: number;
    sourcePath?: BusPath;
    correlationId?: string;
};

export type CommandHandler<C extends AppCommand = AppCommand> =
    (cmd: C, ctx: { path: BusPath }) => "handled" | void;

export type AppCommand = LoadConfigCommand | WatchConfigCommand;

@Injectable({ providedIn: "root" })
export class CommandBus {
    private tree: MapArray<CommandHandler> = new Map();

    public on(path: BusPath, handler: CommandHandler) {
        const arr = this.tree.get(key(path)) ?? [];
        arr.push(handler);
        this.tree.set(key(path), arr);
    }
    public off(path: BusPath, handler: CommandHandler) {
        const k = key(path);
        const arr = this.tree.get(k);
        if (!arr) return;
        const next = arr.filter(h => h !== handler);
        next.length ? this.tree.set(k, next) : this.tree.delete(k);
    }

    /** Reaktives Abo (keine Phasenfilter, da Commands keine Phasen haben) */
    public on$<K extends AppCommand["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
    }): Observable<Extract<AppCommand, { type: K }>> {
        const { path, type } = opts;
        const types = type ? (Array.isArray(type) ? type : [type]) : null;

        return new Observable<Extract<AppCommand, { type: K }>>(subscriber => {
            const handler: CommandHandler = (cmd, ctx) => {
                if (types && !types.includes(cmd.type as K)) return;
                subscriber.next(cmd as Extract<AppCommand, { type: K }>);
            };
            this.on(path, handler);
            return () => this.off(path, handler);
        });
    }

    public onType$<K extends AppCommand["type"]>(
        type: K,
        path?: BusPath
    ): Observable<Extract<AppCommand, { type: K }>> {
        return this.on$<K>({ path: path ?? ["app"], type });
    }

    public once$<K extends AppCommand["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        predicate?: (cmd: Extract<AppCommand, { type: K }>) => boolean;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Observable<Extract<AppCommand, { type: K }>> {
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

    public onceType$<K extends AppCommand["type"]>(
        type: K,
        path?: BusPath
    ): Observable<Extract<AppCommand, { type: K }>> {
        return this.once$<K>({ path: path ?? ["app"], type });
    }

    public waitForOnce<K extends AppCommand["type"]>(opts: {
        path: BusPath;
        type?: K | K[];
        predicate?: (cmd: Extract<AppCommand, { type: K }>) => boolean;
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<Extract<AppCommand, { type: K }>> {
        return firstValueFrom(this.once$<K>(opts));
    }

    /**
     * send: führt entlang der Pfadkette (capture → target → bubble) aus
     * und bricht ab, sobald irgendein Handler "handled" zurückgibt.
     * Phasen existieren NICHT auf dem Command selbst.
     * Rückgabewert = true, wenn behandelt.
     */
    public send(cmd: AppCommand): boolean {
        const path = cmd.targetPath ?? ["app"];
        const chain = buildChain(path);

        // capture
        for (const p of chain.slice(0, -1))
            if (this.dispatch(cmd, p)) return true;

        // target
        if (this.dispatch(cmd, chain[chain.length - 1])) return true;

        // bubble
        for (const p of [...chain].reverse().slice(1))
            if (this.dispatch(cmd, p)) return true;

        return false;
    }

    private dispatch(cmd: AppCommand, path: BusPath): boolean {
        const handlers = this.tree.get(key(path)) ?? [];
        for (const h of handlers) {
            const res = h({ ...cmd }, { path });
            if (res === "handled") return true;
        }
        return false;
    }
}

// ---------------------------------------------------------
// Optionale Fassade, falls du beides unter einer API nutzen willst
// ---------------------------------------------------------
@Injectable({ providedIn: "root" })
export class AppBus {
    constructor(
        private readonly events: EventBus,
        private readonly commands: CommandBus
    ) {}

    // Convenience:
    public emit(ev: AppEvent) { this.events.emit(ev); }
    public send(cmd: AppCommand) { return this.commands.send(cmd); }
    public onCommand$<K extends AppCommand["type"]>(
        type: K,
        path?: BusPath
    ): Observable<Extract<AppCommand, { type: K }>> {
        return this.commands.onType$<K>(type, path)
    }
    public onceCommand$<K extends AppCommand["type"]>(
        type: K,
        path?: BusPath
    ): Observable<Extract<AppCommand, { type: K }>> {
        return this.commands.onceType$<K>(type, path)
    }
}
