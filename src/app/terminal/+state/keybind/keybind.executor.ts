import {Subscription} from "rxjs";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {FocusHandler} from "../handler/focus.handler";
import {SelectionHandler} from "../handler/selection.handler";

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
            path: ['app', 'action'],
            type: 'ActionFired'
        }).subscribe(async event => {
            if(!this._focusHandler?.hasFocus() && !event.trigger?.all) return;
            switch (event.payload) {
                case 'split_right': {
                    this._bus.publish({type: 'SplitPaneRight', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_left': {
                    this._bus.publish({type: 'SplitPaneLeft', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_down': {
                    this._bus.publish({type: 'SplitPaneDown', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_up': {
                    this._bus.publish({type: 'SplitPaneUp', payload: this._terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
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
                case 'close_terminal': {
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
