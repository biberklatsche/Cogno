import {Path} from '../../_tauri/path';
import { isDevMode } from '@angular/core';
import {Logger} from "../../_tauri/logger";

export const Environment = (() => {
    // --- interne Variablen ---
    let homeDir = '';
    let configFilePath = '';
    let dbFilePath = '';

    // --- interne Hilfsfunktionen ---
    async function determineCognoPaths() {
        const homeDirName = isDevMode() ? '.cogno-dev' : '.cogno';
        homeDir = await Path.join(await Path.homeDir(), homeDirName);
        dbFilePath = await Path.join(homeDir, 'cogno.db');
        configFilePath = await Path.join(homeDir, 'cogno.config');
        Logger.info(`Loaded ${homeDir}`);
    }

    // --- öffentliches API ---
    return {
        /** Gibt das Konfigurationsverzeichnis zurück */
        configDir(): string {
            return homeDir;
        },

        /** Gibt den vollständigen Pfad zur Config-Datei zurück */
        configFilePath(): string {
            return configFilePath;
        },

        /** Gibt den vollständigen Pfad zur Datenbankdatei zurück */
        dbFilePath(): string {
            return dbFilePath;
        },

        /** Initialisiert das Environment (ermittelt alle Pfade) */
        async init(): Promise<void> {
            Logger.info('Initializing environment');
            await determineCognoPaths();
        },
    };
})();
