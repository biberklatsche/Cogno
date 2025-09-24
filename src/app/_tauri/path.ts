import { join as tauriJoin, homeDir as tauriHomeDir } from '@tauri-apps/api/path';

export const Path = {

    join(...paths: string[]): Promise<string> { return tauriJoin(...paths)},

    homeDir():Promise<string>{return tauriHomeDir()}
}
