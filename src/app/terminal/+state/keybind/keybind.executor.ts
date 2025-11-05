import {Subscription} from "rxjs";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {FocusHandler} from "../handler/focus.handler";
import {SelectionHandler} from "../handler/selection.handler";
import {ConfigService} from "../../../config/+state/config.service";
import {Clipboard} from "../../../_tauri/clipboard";
import {InputHandler} from "../handler/input.handler";

export class KeybindExecutor implements IDisposable  {

    private _subscription?: Subscription;

    constructor(
        private _bus: AppBus,
        private _focusHandler: FocusHandler,
        private _selectionHandler: SelectionHandler,
        private _terminalId: string,
    ) {
        this._subscription = new Subscription();
        this._subscription.add(this._bus.on$({
            path: ['app', 'terminal'],
            type: 'KeybindFired'
        }).subscribe(async event => {
            if(!this._focusHandler?.hasFocus() && !event.trigger?.all) return;
            switch (event.payload) {
                case 'copy': {
                    const isPerformable = this.calcPreventDefault(event.trigger?.performable, () => this._selectionHandler!.hasSelection());
                    if (isPerformable) {
                        this._bus.publish({type: 'Copy', payload: this._terminalId, path: ['app', 'terminal']});
                        event.performed = true;
                    }
                    break;
                }
                case 'paste': {
                    this._bus.publish({type: 'Paste', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'clear_buffer': {
                    this._bus.publish({type: 'ClearBuffer', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'close_active_terminal': {
                    this._bus.publish({type: 'RemovePane', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                }
            }
        }));
    }

    dispose(): void {
        this._subscription?.unsubscribe();
        this._subscription = undefined;
    }

    private calcPreventDefault(performableTrigger: boolean | undefined, proof:() => boolean): boolean {
        let isPerformable = true;
        if(performableTrigger) isPerformable = proof();
        return isPerformable;
    }
}
