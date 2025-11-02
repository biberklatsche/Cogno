import {KeyboardMappingService} from "./keyboard/keyboard-layout.loader";
import {DestroyRef, Injectable} from "@angular/core";
import {ConfigService} from "../config/+state/config.service";
import {KeybindingMatcher} from "./keybind.matcher";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {OS} from "../_tauri/os";
import {ActionBase, AppBus} from "../app-bus/app-bus";
import {ActionName} from "../config/+models/config";


export type KeybindFiredEvent = ActionBase<"KeybindFired", ActionName>

@Injectable({
    providedIn: 'root'
})
export class KeybindService {

    private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher(OS.platform());

    constructor(keyboardMappingService: KeyboardMappingService, configService: ConfigService, bus: AppBus, ref: DestroyRef) {
        keyboardMappingService.loadLayout().then(s => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
        configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(c => this._keybindMatcher.initBindings(c.keybind!));
        window.addEventListener("keydown", (e) => {
            const keybindFiredEvent = this._keybindMatcher.match(e);
            if(keybindFiredEvent){
                keybindFiredEvent.path = ['app', 'terminal'];
                console.log('fire!!', keybindFiredEvent);
                const isHandled = bus.publish(keybindFiredEvent);
                console.log('is handlet!!', isHandled);
                if(isHandled || !keybindFiredEvent.triggers?.find(s => s === 'performable')){
                    e.preventDefault();
                    e.stopPropagation();
                }

            }
        }, { capture: true });
    }
}
