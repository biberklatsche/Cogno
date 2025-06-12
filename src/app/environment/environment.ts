import {Path} from "../_tauri/path";
import { isDevMode } from '@angular/core';

export namespace Environment {

    let _configDir: string = '';

    export function configDir(): string {
        return _configDir;
    }

    export async function init() : Promise<void> {
        await Promise.all([_loadConfigDir()])
    }

    async function _loadConfigDir()  {
        const configDir = isDevMode() ? '.cogno-dev' : '.cogno';
        _configDir = await Path.join(await Path.homeDir(), configDir);
    }
}
