import {DestroyRef, Injectable} from '@angular/core';
import {TabListService} from "../tab-list/+state/tab-list.service";
import {AppWindow} from "../_tauri/window";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AppBus} from "../app-bus/app-bus";
import {invoke} from "@tauri-apps/api/core";
import {Logger} from "../_tauri/logger";
import {Process} from "../_tauri/process";

@Injectable({
  providedIn: 'root'
})
export class WindowService {
  constructor(bus: AppBus, private tablist: TabListService, ref: DestroyRef) {
      bus.publish({type: "LoadConfigCommand"});
      bus.publish({type: "WatchConfigCommand"});
      bus.once$({path: ['app', 'config'], type: 'ConfigLoaded'});
      bus.on$({path: ['app', 'action'], type: 'ActionFired'})
          .pipe(takeUntilDestroyed(ref))
          .subscribe(async(event)=> {
              switch (event.payload) {
                  case 'quit':
                      //Schließt alle Windows
                      await Process.exit();
                      event.performed = true;
                      break;
                  case 'new_window':
                      invoke('new_window').catch((err) => {
                          Logger.error('Failed to open new window', err);
                      });
                      event.performed = true;
                      break;
                  case 'close_window':
                      AppWindow.close().then(() => Logger.debug('close window'));
                      event.performed = true;
                      break;
              }
          });

      AppWindow.onCloseRequested$
          .pipe(takeUntilDestroyed(ref))
          .subscribe(() => {
              bus.publish({type: "ActionFired", path: ['app', 'action'], payload: 'close_all_tabs'});
          });
  }
}
