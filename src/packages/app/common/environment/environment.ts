import {Path} from '@cogno/app-tauri/path';
import { isDevMode } from '@angular/core';
import {Logger} from "@cogno/app-tauri/logger";

export const Environment = (() => {
    let homeDir = '';
    let configFilePath = '';
    let dbFilePath = '';
    let exeDirPath = ''

    async function determineCognoPaths() {
        const devMode = isDevMode();
        homeDir = await Path.cognoHomeDir(devMode);
        exeDirPath = await Path.exeDir();
        dbFilePath = await Path.cognoDbFilePath(devMode);
        configFilePath = await Path.cognoConfigFilePath(devMode);
        Logger.info(`Loaded ${homeDir}`);
    }

    return {
        /** Returns the configuration directory */
        configDir(): string {
            return homeDir;
        },

        /** Returns the full path to the config file */
        configFilePath(): string {
            return configFilePath;
        },

        /** Returns the full path to the database file */
        dbFilePath(): string {
            return dbFilePath;
        },

        /** Returns the full path to the executable */
        exeDirPath(): string {
            return exeDirPath;
        },

        /** Returns whether we're in dev mode */
        isDevMode(): boolean {
            return isDevMode();
        },

        /** Initializes the environment (determines all paths) */
        async init(): Promise<void> {
            Logger.info('Initializing environment');
            await determineCognoPaths();
        },
    };
})();


