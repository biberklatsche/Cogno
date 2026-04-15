import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Logger } from "@cogno/app-tauri/logger";
import { AppWindow } from "@cogno/app-tauri/window";
import { ActionFired } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class AppButtonsService {
  private _isMaximized = signal<boolean>(false);
  readonly isMaximized = this._isMaximized.asReadonly();

  constructor(
    destroyRef: DestroyRef,
    private bus: AppBus,
  ) {
    AppWindow.windowSize$.pipe(takeUntilDestroyed(destroyRef)).subscribe(async (_size) => {
      this._isMaximized.set(await AppWindow.isMaximized());
    });
  }

  closeWindow(): void {
    this.bus.publish(ActionFired.create("close_window"));
  }

  minimizeWindow() {
    AppWindow.minimize().then(() => Logger.debug("minimize window"));
  }

  maximizeWindow() {
    AppWindow.maximize().then(() => Logger.debug("maximize window"));
  }

  unmaximizeWindow() {
    AppWindow.unmaximize().then(() => Logger.debug("unmaximize window"));
  }
}
