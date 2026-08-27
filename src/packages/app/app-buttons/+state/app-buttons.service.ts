import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Logger } from "@cogno/platform/logger";
import { AppWindow } from "@cogno/platform/window";
import { ActionFired } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class AppButtonsService {
  private _isMaximized = signal<boolean>(false);
  readonly isMaximized = this._isMaximized.asReadonly();

  constructor(
    private readonly appWindow: AppWindow,
    destroyRef: DestroyRef,
    private bus: AppBus,
  ) {
    this.appWindow.windowSize$.pipe(takeUntilDestroyed(destroyRef)).subscribe(async (_size) => {
      this._isMaximized.set(await this.appWindow.isMaximized());
    });
  }

  closeWindow(): void {
    this.bus.publish(ActionFired.create("close_window"));
  }

  minimizeWindow() {
    this.appWindow.minimize().then(() => Logger.debug("minimize window"));
  }

  maximizeWindow() {
    this.appWindow.maximize().then(() => Logger.debug("maximize window"));
  }

  unmaximizeWindow() {
    this.appWindow.unmaximize().then(() => Logger.debug("unmaximize window"));
  }
}
