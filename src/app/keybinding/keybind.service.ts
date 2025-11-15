import {KeyboardMappingService} from "./keyboard/keyboard-layout.loader";
import {DestroyRef, Injectable} from "@angular/core";
import {ConfigService} from "../config/+state/config.service";
import {KeybindingMatcher} from "./keybind.matcher";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ActionDefinition} from "./keybind-action.interpreter";
import {AppBus} from "../app-bus/app-bus";
import {ActionName} from "../action/action.models";

@Injectable({
    providedIn: 'root'
})
export class KeybindService {

    private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher();

    constructor(keyboardMappingService: KeyboardMappingService, configService: ConfigService, bus: AppBus, ref: DestroyRef) {
        keyboardMappingService.loadLayout().then(s => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
        configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(c => this._keybindMatcher.initBindings(c.keybind!));
        window.addEventListener("keydown", (e) => {
            const ActionFiredEvent = this._keybindMatcher.match(e);
            if (!ActionFiredEvent) return;
            const result = bus.publish(ActionFiredEvent.event);
            bus.publish({type: "Inspector", path: ['inspector'], payload: {type: 'keybind', data: ActionFiredEvent.eventKey}});
            if(ActionFiredEvent.event.trigger?.unconsumed) return;
            if(ActionFiredEvent.event.trigger?.performable && !result.performed) return;
            if(!result.defaultPrevented && !result.propagationStopped) return;
            e.preventDefault();
            e.stopPropagation();
        }, {capture: true});
    }

    getKeybinding(actinName: ActionName): string | undefined {
        return this._keybindMatcher.getKeybinding(actinName);
    }

    getActionDefinition(actionName: ActionName): ActionDefinition | undefined {
        return this._keybindMatcher.getAction(actionName);
    }
}
