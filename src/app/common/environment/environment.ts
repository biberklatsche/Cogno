import {Path} from '../../_tauri/path';
import { isDevMode } from '@angular/core';
import {OS, OsType} from '../../_tauri/os';

export namespace Environment {

    let _homeDir: string = '';
    let _settingsFilePath: string = '';
    let _dbFileFilePath: string = '';

    export function configDir(): string {
        return _homeDir;
    }

    export function settingsFilePath(): string {
        return _settingsFilePath;
    }

    export function dbFilePath(): string {
        return _dbFileFilePath;
    }

    export function platform(): OsType {
        return OS.platform();
    }

    export async function init() : Promise<void> {
        await Promise.all([_determineCognoPaths()])
    }

    async function _determineCognoPaths()  {
        const homeDirName = isDevMode() ? '.cogno-dev' : '.cogno';
        _homeDir = await Path.join(await Path.homeDir(), homeDirName);
        _dbFileFilePath = await Path.join(_homeDir, 'cogno.db');
        _settingsFilePath = await Path.join(_homeDir, 'settings.json');
        console.log(`Loaded ${_homeDir}`);
    }
}
