import {Injectable, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AppWindow} from "../../../_tauri/window";
import {DestroyRef} from '@angular/core';
import {Logger} from "../../../_tauri/logger";


@Injectable()
export class WindowButtonsService {

    private _isMaximized = signal<boolean>(false);
    /** Für Komponenten/Template: direkt lesbar, aber nicht setzbar */
    readonly isMaximized = this._isMaximized.asReadonly();


    constructor(destroyRef: DestroyRef) {
        AppWindow.windowSize$.pipe(takeUntilDestroyed(destroyRef)).subscribe(async size => {
            this._isMaximized.set(await AppWindow.isMaximized());
        });
    }

    closeWindow(): void {
        AppWindow.close().then(() => Logger.debug('close window'));
    }

    minimizeWindow() {
        AppWindow.minimize().then(() => Logger.debug('minimize window'));
    }

    maximizeWindow() {
        AppWindow.maximize().then(() => Logger.debug('maximize window'));
    }

    unmaximizeWindow() {
        AppWindow.unmaximize().then(() => Logger.debug('unmaximize window'));
    }
}
