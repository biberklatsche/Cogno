import { readTextFile } from '@tauri-apps/plugin-fs';
import { appConfigDir } from '@tauri-apps/api/path';

export namespace Fs {

    export const configDir = ():Promise<string> => appConfigDir();

    export const readFile= (path: string): Promise<string> => readTextFile(path);
}
