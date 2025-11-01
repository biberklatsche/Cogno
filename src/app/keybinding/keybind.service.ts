import {KeyboardMappingService} from "./keyboard/keyboard-layout.loader";
import {DestroyRef, Injectable} from "@angular/core";
import {ConfigService} from "../config/+state/config.service";
import {KeybindingMatcher} from "./keybind.matcher";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {OS} from "../_tauri/os";

@Injectable({
    providedIn: 'root'
})
export class KeybindService {

    private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher(OS.platform());

    constructor(keyboardMappingService: KeyboardMappingService, configService: ConfigService, ref: DestroyRef) {
        keyboardMappingService.loadLayout().then(s => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
        configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(c => this._keybindMatcher.initBindings(c.keybind!));
        window.addEventListener("keydown", (e) => {
            const action = this._keybindMatcher.match(e);
            if(action){
                e.preventDefault();
                e.stopPropagation();
                console.log('######fire action', action);
            }
        }, { capture: true });
    }
}
