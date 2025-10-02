import {Path} from '../../_tauri/path';
import { isDevMode } from '@angular/core';

export namespace Environment {

    let _homeDir: string = '';
    let _configFilePath: string = '';
    let _dbFileFilePath: string = '';

    export function configDir(): string {
        return _homeDir;
    }

    export function configFilePath(): string {
        return _configFilePath;
    }

    export function dbFilePath(): string {
        return _dbFileFilePath;
    }

    export async function init() : Promise<void> {
        await Promise.all([_determineCognoPaths()])
    }

    async function _determineCognoPaths()  {
        const homeDirName = isDevMode() ? '.cogno-dev' : '.cogno';
        _homeDir = await Path.join(await Path.homeDir(), homeDirName);
        _dbFileFilePath = await Path.join(_homeDir, 'cogno.db');
        _configFilePath = await Path.join(_homeDir, 'cogno.config');
        console.log(`Loaded ${_homeDir}`);
    }
}
