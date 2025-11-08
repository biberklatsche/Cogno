import {DestroyRef, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {fromEvent} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {Keybinding} from "../../keybinding/keybind.matcher";

export type MousePosition = { x: number; y: number };
export type TerminalMousePosition = { col: number; row: number; char: string };
export type TerminalDimensions = { cols: number; rows: number };

@Injectable()
export class InspectorService {

  private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);
  private _mousePosition: WritableSignal<MousePosition | undefined> = signal(undefined);
  private _terminalMousePosition: WritableSignal<TerminalMousePosition | undefined> = signal(undefined);
  private _terminalDimensions: WritableSignal<TerminalDimensions | undefined> = signal(undefined);

  public get firedKeybinding(): Signal<Keybinding | undefined> {
      return this._firedKeybinding.asReadonly();
  }

  public get mousePosition(): Signal<MousePosition | undefined> {
      return this._mousePosition.asReadonly();
  }

  public get terminalMousePosition(): Signal<TerminalMousePosition | undefined> {
      return this._terminalMousePosition.asReadonly();
  }

  public get terminalDimensions(): Signal<TerminalDimensions | undefined> {
      return this._terminalDimensions.asReadonly();
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
                  this._terminalMousePosition.set(event.payload?.data);
                  break;
              }
              case 'terminal-dimensions': {
                  this._terminalDimensions.set(event.payload?.data);
                  break;
              }
          }
      });

      // Track global mouse movement
      fromEvent<MouseEvent>(window, 'mousemove')
        .pipe(takeUntilDestroyed(ref))
        .subscribe(evt => {
          this._mousePosition.set({ x: evt.clientX, y: evt.clientY });
        });
  }
}
