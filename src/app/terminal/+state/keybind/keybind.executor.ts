import {Subscription} from "rxjs";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {TerminalStateManager} from "../state";

export class KeybindExecutor implements IDisposable  {

    private _subscription?: Subscription;

    constructor(
        private _bus: AppBus,
        private _stateManager: TerminalStateManager,
    ) {
        this._subscription = new Subscription();
        this._subscription.add(this._bus.on$({
            path: ['app', 'action'],
            type: 'ActionFired'
        }).subscribe(async event => {
            if(!this._stateManager.isFocused && !event.trigger?.all) return;
            switch (event.payload) {
                case 'split_right': {
                    this._bus.publish({type: 'SplitPaneRight', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_left': {
                    this._bus.publish({type: 'SplitPaneLeft', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_down': {
                    this._bus.publish({type: 'SplitPaneDown', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'split_up': {
                    this._bus.publish({type: 'SplitPaneUp', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_next_pane': {
                    this._bus.publish({type: 'SelectNextPane', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_previous_pane': {
                    this._bus.publish({type: 'SelectPreviousPane', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'copy': {
                    const isPerformable = this.calcPreventDefault(event.trigger?.performable, () => this._stateManager.hasSelection);
                    if (isPerformable) {
                        this._bus.publish({type: 'Copy', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                        event.performed = true;
                    }
                    break;
                }
                case 'paste': {
                    this._bus.publish({type: 'Paste', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'cut': {
                    const isPerformable = this.calcPreventDefault(event.trigger?.performable, () => this._stateManager.hasSelection);
                    if (isPerformable) {
                        this._bus.publish({type: 'Cut', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                        event.performed = true;
                    }
                    break;
                }
                case 'clear_buffer': {
                    this._bus.publish({type: 'ClearBuffer', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'close_terminal': {
                    this._bus.publish({type: 'RemovePane', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'maximize_pane':
                case 'minimize_pane': {
                    this._bus.publish({
                        type: 'MaximizePane',
                        payload: this._stateManager.terminalId,
                        path: ['app', 'terminal']
                    });
                    event.performed = true;
                    break;
                }
                case 'clear_line': {
                    this._bus.publish({type: 'ClearLine', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'clear_line_to_end': {
                    this._bus.publish({type: 'ClearLineToEnd', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'clear_line_to_start': {
                    this._bus.publish({type: 'ClearLineToStart', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'delete_previous_word': {
                    this._bus.publish({type: 'DeletePreviousWord', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'delete_next_word': {
                    this._bus.publish({type: 'DeleteNextWord', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'go_to_next_word': {
                    this._bus.publish({type: 'GoToNextWord', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'go_to_previous_word': {
                    this._bus.publish({type: 'GoToPreviousWord', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_text_right': {
                    this._bus.publish({type: 'SelectTextRight', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_text_left': {
                    this._bus.publish({type: 'SelectTextLeft', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_word_right': {
                    this._bus.publish({type: 'SelectWordRight', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_word_left': {
                    this._bus.publish({type: 'SelectWordLeft', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_text_to_end_of_line': {
                    this._bus.publish({type: 'SelectTextToEndOfLine', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_text_to_start_of_line': {
                    this._bus.publish({type: 'SelectTextToStartOfLine', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
                    break;
                }
                case 'select_all': {
                    this._bus.publish({type: 'SelectAll', payload: this._stateManager.terminalId, path: ['app', 'terminal']});
                    event.performed = true;
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
