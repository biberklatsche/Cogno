import { join as tauriJoin, homeDir as tauriHomeDir } from '@tauri-apps/api/path';

export namespace Path {

    export const join= (...paths: string[]): Promise<string> => tauriJoin(...paths);

    export const homeDir= ():Promise<string> => tauriHomeDir();
}
