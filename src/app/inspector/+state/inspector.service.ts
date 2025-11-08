import {DestroyRef, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AppBus} from "../../app-bus/app-bus";
import {Keybinding} from "../../keybinding/keybind.matcher";

@Injectable()
export class InspectorService {

  private _firedKeybinding: WritableSignal<Keybinding | undefined> = signal(undefined);

  public get firedKeybinding(): Signal<Keybinding | undefined> {
      return this._firedKeybinding.asReadonly();
  }

  constructor(bus: AppBus, ref: DestroyRef) {
      console.log('InspectorService constructor');
      bus.on$({type: 'Inspector', path: ['inspector']}).pipe(takeUntilDestroyed(ref)).subscribe(event => {
          switch (event.payload?.type) {
              case 'keybind': {
                    this._firedKeybinding.set(event.payload?.data);
                  break;
              }
          }
      });
  }
}
