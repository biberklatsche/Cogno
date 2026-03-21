import {DestroyRef, Injectable} from '@angular/core';
import {AppWindow} from "../_tauri/window";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {AppBus} from "../app-bus/app-bus";
import {invoke} from "@tauri-apps/api/core";
import {Logger} from "../_tauri/logger";
import {Process} from "../_tauri/process";
import {ActionFired} from "../action/action.models";
import { TerminalBusyStateService } from "../terminal/terminal-busy-state.service";

@Injectable({
  providedIn: 'root'
})
export class WindowService {
  private isClosing = false;

  constructor(
      private readonly bus: AppBus,
      private readonly terminalBusyStateService: TerminalBusyStateService,
      ref: DestroyRef,
  ) {
      this.bus.publish({type: "InitConfigCommand"});
      this.bus.on$({path: ['app', 'action'], type: 'ActionFired'})
          .pipe(takeUntilDestroyed(ref))
          .subscribe(async(event)=> {
              switch (event.payload) {
                  case 'quit':
                      if (!(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals('quit the application'))) {
                          return;
                      }
                      // Closes all windows
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
                      // Only close if all pre-close handlers are done (marked by 'ready_to_close')
                      if (event.args?.includes('workspace_saved')) {
                          if (!(await this.terminalBusyStateService.confirmProceedIfNoBusyTerminals('close the application window'))) {
                              return;
                          }
                          this.isClosing = true;
                          AppWindow.close().then(() => Logger.debug('close window'));
                          event.performed = true;
                      }
                      break;
              }
          });

      AppWindow.onCloseRequested$
          .pipe(takeUntilDestroyed(ref))
          .subscribe(async (evt) => {
              // Prevent infinite loop
              if (this.isClosing) return;

              // Prevent the window from closing immediately
              evt.preventDefault();

              // Fire close_window event - other services can intercept to do cleanup
              // They should re-fire with 'ready_to_close' when done
              this.bus.publish(ActionFired.create('close_window', undefined, []));
          });
  }
}
