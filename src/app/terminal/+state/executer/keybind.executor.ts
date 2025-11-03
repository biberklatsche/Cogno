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
        private _inputHandler: InputHandler,
        private _configService: ConfigService,
    ) {
        this._subscription = new Subscription();
        this._subscription.add(this._bus.on$({
            path: ['app', 'terminal'],
            type: 'KeybindFired'
        }).subscribe(async event => {
            if(!this._focusHandler?.hasFocus() && !event.trigger?.all) return;
            switch (event.payload) {
                case 'copy': {
                    event.defaultPrevented = this.calcPreventDefault(event.trigger?.performable, () => this._selectionHandler!.hasSelection());
                    if (event.defaultPrevented) {
                        await Clipboard.writeText(this._selectionHandler!.getSelection());
                        if(this._configService.config.selection?.clear_on_copy) {
                            this._selectionHandler?.clearSelection();
                        }
                    }
                    break;
                }
                case 'paste': {
                    event.defaultPrevented = this.calcPreventDefault(event.trigger?.performable, () => this._selectionHandler!.hasSelection());
                    if (event.defaultPrevented) {
                        this._inputHandler.write(await Clipboard.readText());
                    }
                    break;
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
