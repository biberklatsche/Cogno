import {KeyboardMappingService} from "./keyboard/keyboard-layout.loader";
import {DestroyRef, Injectable} from "@angular/core";
import {ConfigService} from "../config/+state/config.service";
import {KeybindingMatcher} from "./keybind.matcher";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ActionDefinition} from "./keybind-action.interpreter";
import {AppBus} from "../app-bus/app-bus";
import {ActionName} from "../action/action.models";
import {Logger} from "../_tauri/logger";

type Key = string;

interface KeyListener {
    readonly id: string;
    readonly handler: (e: KeyboardEvent) => void;
}

type ListenerStack = KeyListener[];

@Injectable({
    providedIn: 'root'
})
export class KeybindService {

    private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher();
    // simple registry for component-specific key listeners
    private readonly listeners = new Map<Key, ListenerStack>();

    constructor(keyboardMappingService: KeyboardMappingService, configService: ConfigService, bus: AppBus, ref: DestroyRef) {
        keyboardMappingService.loadLayout().then(s => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
        configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(c => this._keybindMatcher.initBindings(c.keybind!));
        window.addEventListener("keydown", (e) => {
            // 1) Check registered listeners first (e.g., side menu overlays)
            const stack = this.listeners.get(e.key);
            if(stack && stack?.length) {
                stack.at(-1)?.handler(e);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const ActionFiredEvent = this._keybindMatcher.match(e);
            if (!ActionFiredEvent) return;
            Logger.info('Action fired' + ActionFiredEvent.event.payload);
            const result = bus.publish(ActionFiredEvent.event);
            bus.publish({type: "Inspector", path: ['inspector'], payload: {type: 'keybind', data: ActionFiredEvent.eventKey}});
            if(ActionFiredEvent.event.trigger?.unconsumed) return;
            if(ActionFiredEvent.event.trigger?.performable && !result.performed) return;
            e.preventDefault();
            e.stopPropagation();
        }, {capture: true});
    }

    private getStack(key: Key): ListenerStack {
        let stack = this.listeners.get(key);
        if (!stack) {
            stack = [];
            this.listeners.set(key, stack);
        }
        return stack;
    }

    getKeybinding(actinName: ActionName): string | undefined {
        return this._keybindMatcher.getKeybinding(actinName);
    }

    getActionDefinition(actionName: ActionName): ActionDefinition | undefined {
        return this._keybindMatcher.getAction(actionName);
    }

    /** Register a temporary key listener by id. Subsequent calls with the same id overwrite keys/handler. */
    registerListener(
        id: string,
        keys: readonly Key[],
        handler: (e: KeyboardEvent) => void
    ): void {
        for (const key of keys) {
            const stack = this.getStack(key);

            // remove existing registration
            const index = stack.findIndex(l => l.id === id);
            if (index !== -1) stack.splice(index, 1);

            stack.push({ id, handler });
        }
    }

    /** Remove a previously registered listener. */
    unregisterListener(id: string): void {
        for (const stack of this.listeners.values()) {
            const index = stack.findIndex(l => l.id === id);
            if (index !== -1) stack.splice(index, 1);
        }
    }
}
