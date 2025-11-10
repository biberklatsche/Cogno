import {DestroyRef, Injectable, Signal, signal, WritableSignal, computed} from '@angular/core';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {fromEvent} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {Keybinding} from "../../keybinding/keybind.matcher";
import {TerminalId} from "../../grid-list/+model/model";

export type MousePosition = { x: number; y: number };
export type TerminalMousePosition = { col: number; row: number; char: string };
export type TerminalCursorPosition = { col: number; row: number; char: string };
export type TerminalDimensions = { cols: number; rows: number };

@Injectable()
export class InspectorService {

  private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);
  private _mousePosition: WritableSignal<MousePosition | undefined> = signal(undefined);

  // Per-terminal maps
  private _terminalMouseById: WritableSignal<Record<TerminalId, TerminalMousePosition>> = signal({} as Record<TerminalId, TerminalMousePosition>);
  private _terminalCursorById: WritableSignal<Record<TerminalId, TerminalCursorPosition>> = signal({} as Record<TerminalId, TerminalCursorPosition>);
  private _terminalDimsById: WritableSignal<Record<TerminalId, TerminalDimensions>> = signal({} as Record<TerminalId, TerminalDimensions>);

  // Derived list of terminalIds present in either map
  private _terminalIds = computed<TerminalId[]>(() => {
      const ids = new Set<string>([...Object.keys(this._terminalMouseById()), ...Object.keys(this._terminalDimsById())]);
      return Array.from(ids) as TerminalId[];
  });

  public get firedKeybinding(): Signal<Keybinding | undefined> {
      return this._firedKeybinding.asReadonly();
  }

  public get mousePosition(): Signal<MousePosition | undefined> {
      return this._mousePosition.asReadonly();
  }

  public get terminalMouseById(): Signal<Record<TerminalId, TerminalMousePosition>> {
      return this._terminalMouseById.asReadonly();
  }

    public get terminalCursorById(): Signal<Record<TerminalId, TerminalMousePosition>> {
        return this._terminalCursorById.asReadonly();
    }

  public get terminalDimsById(): Signal<Record<TerminalId, TerminalDimensions>> {
      return this._terminalDimsById.asReadonly();
  }

  public get terminalIds(): Signal<TerminalId[]> {
      return this._terminalIds;
  }

  constructor(bus: AppBus, ref: DestroyRef) {
      // Listen to app-bus events
      bus.on$({type: 'Inspector', path: ['inspector']}).pipe(takeUntilDestroyed(ref)).subscribe(event => {
          switch (event.payload?.type) {
              case 'keybind': {
                  this._firedKeybinding.set(event.payload?.data);
                  break;
              }
              case 'terminal-mouse-position': {
                  const { terminalId, col, row, char } = event.payload?.data ?? {};
                  if (!terminalId) break;
                  const next = { ...this._terminalMouseById() };
                  next[terminalId as TerminalId] = { col, row, char } as TerminalMousePosition;
                  this._terminalMouseById.set(next);
                  break;
              }
              case 'terminal-cursor-position': {
                  const { terminalId, col, row, char } = event.payload?.data ?? {};
                  if (!terminalId) break;
                  const next = { ...this._terminalCursorById() };
                  next[terminalId as TerminalId] = { col, row, char } as TerminalCursorPosition;
                  this._terminalCursorById.set(next);
                  break;
              }
              case 'terminal-dimensions': {
                  const { terminalId, cols, rows } = event.payload?.data ?? {};
                  if (!terminalId) break;
                  const next = { ...this._terminalDimsById() };
                  next[terminalId as TerminalId] = { cols, rows } as TerminalDimensions;
                  this._terminalDimsById.set(next);
                  break;
              }
          }
      });

      // Remove per-terminal data when pane is closed (listen on both app and app/terminal paths)
      bus.on$({ path: ['app', 'terminal'], type: 'TerminalRemoved' }).pipe(takeUntilDestroyed(ref)).subscribe(evt => {
          const id = evt.payload;
          if (!id) return;
          const nextMouse = { ...this._terminalMouseById() };
          const nextDims = { ...this._terminalDimsById() };
          delete nextMouse[id];
          delete nextDims[id];
          this._terminalMouseById.set(nextMouse);
          this._terminalDimsById.set(nextDims);
      });

      // Track global mouse movement
      fromEvent<MouseEvent>(window, 'mousemove')
        .pipe(takeUntilDestroyed(ref))
        .subscribe(evt => {
          this._mousePosition.set({ x: evt.clientX, y: evt.clientY });
        });
  }
}
