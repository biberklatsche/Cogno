import {KeyboardMappingService} from "./keyboard/keyboard-layout.loader";
import {DestroyRef, Injectable} from "@angular/core";
import {ConfigService} from "../config/+state/config.service";
import {KeybindingMatcher} from "./keybind.matcher";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ActionDefinition} from "./keybind-action.interpreter";
import {AppBus} from "../app-bus/app-bus";
import {ActionName} from "../action/action.models";
import {Logger} from "../_tauri/logger";

@Injectable({
    providedIn: 'root'
})
export class KeybindService {

    private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher();
    // simple registry for component-specific key listeners
    private _listeners: Map<string, { keys: Set<string>, handler: (e: KeyboardEvent) => void }> = new Map();

    constructor(keyboardMappingService: KeyboardMappingService, configService: ConfigService, bus: AppBus, ref: DestroyRef) {
        keyboardMappingService.loadLayout().then(s => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
        configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(c => this._keybindMatcher.initBindings(c.keybind!));
        window.addEventListener("keydown", (e) => {
            // 1) Check registered listeners first (e.g., side menu overlays)
            for (const [, listener] of this._listeners) {
                if (listener.keys.has(e.key)) {
                    try { listener.handler(e); } catch {}
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            const ActionFiredEvent = this._keybindMatcher.match(e);
            if (!ActionFiredEvent) return;
            Logger.info('Action fired!!!');
            const result = bus.publish(ActionFiredEvent.event);
            bus.publish({type: "Inspector", path: ['inspector'], payload: {type: 'keybind', data: ActionFiredEvent.eventKey}});
            if(ActionFiredEvent.event.trigger?.unconsumed) return;
            if(ActionFiredEvent.event.trigger?.performable && !result.performed) return;
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

    /** Register a temporary key listener by id. Subsequent calls with the same id overwrite keys/handler. */
    registerListener(id: string, keys: string[], handler: (e: KeyboardEvent) => void): void {
        const keySet = new Set(keys);
        this._listeners.set(id, {keys: keySet, handler});
    }

    /** Remove a previously registered listener. */
    unregisterListener(id: string): void {
        this._listeners.delete(id);
    }
}
