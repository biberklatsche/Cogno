import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export interface IFs {
    readFile(fileName: string, path: string): string;
}

export class Fs {
    async readFile(fileName: string, path: string): Promise<string> {
        return await readTextFile(fileName, {
            baseDir: BaseDirectory.AppConfig,
        });
    }
}
