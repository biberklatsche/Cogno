import {Fs} from "../_tauri/fs";
import {Observable, Subject} from "rxjs";
import {Logger} from "../_tauri/logger";

export namespace Environment {

    let _settings: Subject<any> = new Subject();

    export let settings: Observable<any> = _settings.asObservable();

    export async function init(): Promise<void> {
        Logger.info("Initializing environment...");
        _settings.next({'environment': await Fs.configDir()});
    }
}
