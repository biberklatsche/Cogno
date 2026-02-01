import{DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {BehaviorSubject, filter, Observable, Subscription} from 'rxjs';
import {Config} from "../+models/config";
import {ConfigReader} from "./config.reader";
import {Logger} from "../../_tauri/logger";
import {AppBus} from "../../app-bus/app-bus";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ShellConfigurator} from "../shell-configurator";
import {DefaultConfig} from "../../_tauri/default-config";
import {ConfigWriter} from "./config.writer";
import {ActionFired} from "../../action/action.models";
import {Opener} from "../../_tauri/opener";
import {ShellProfile} from "../+models/shell-config";
import {PromptSegment} from "../+models/prompt-config";
import {ShellIntegrationWriter} from "../shell-integration.writer";


export abstract class ConfigService {
    abstract get config(): Config;
    abstract get config$(): Observable<Config>;

    /**
     * Returns the shell config for a given profile name.
     * Falls name fehlt oder ungültig ist, wird default verwendet.
     */
    abstract getShellProfileOrDefault(name?: string): ShellProfile;

    abstract getPromptSegments(): PromptSegment[];
}


@Injectable()
export class RealConfigService extends ConfigService {
    private _config = new BehaviorSubject<Config | undefined>(undefined);
    private _unwatch: Subscription | undefined;

    get config(): Config {
        if (!this._config.value) {
            throw new Error('Config is not loaded!');
        }
        return this._config.value;
    }

    get config$(): Observable<Config> {
        return this._config.pipe(filter(Boolean));
    }

    /**
     * New API: resolve shell config by profile name
     */
    getShellProfileOrDefault(name?: string): ShellProfile {
        const config = this._config.value;
        if (!config) throw new Error('Config is not loaded!');

        const shell = config.shell;
        if (!shell || !shell.profiles) {
            throw new Error('No shell configuration defined!');
        }

        const profiles = shell.profiles;
        const profileNames = Object.keys(profiles);

        if (profileNames.length === 0) {
            throw new Error('No shell profiles defined!');
        }

        // 1) expliziter Name
        if (name && profiles[name]) {
            return { ...profiles[name] };
        }

        // 2) default
        if (shell.default && profiles[shell.default]) {
            return { ...profiles[shell.default] };
        }

        // 3) Fallback: erstes Profil
        return { ...profiles[profileNames[0]] };
    }

    getPromptSegments(): PromptSegment[] {
        const config = this._config.value;
        if (!config) throw new Error('Config is not loaded!');

        const prompt = config.prompt;
        if (!prompt || !prompt.profile) {
            throw new Error('No prompt configuration defined!');
        }

        const profile = prompt.profile;
        const activeProfileName = prompt.active;
        const order =  profile[activeProfileName].order;
        const segments: PromptSegment[] = [];
        for (const segmentName of order) {
            segments.push(prompt.segment[segmentName]);
        }
        return segments;
    }

    constructor(
        private appBus: AppBus,
        private destroy: DestroyRef,
        private shells: ShellConfigurator
    ) {
        super();

        this.appBus
            .onceType$('InitConfigCommand')
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe(async () => {
                await this.loadConfig();
            });

        this.appBus.on$(ActionFired.listener()).subscribe(async (event) => {
            if (event.payload === 'open_config') {
                await Opener.openPath(Environment.configFilePath());
            }
        });

        this.appBus.on$(ActionFired.listener()).subscribe(async (event) => {
            if (event.payload === 'load_config') {
                await this.loadConfig();
                this.appBus.publish({
                    type: 'Notification',
                    path: ['notification'],
                    payload: { header: 'System', body: 'Config loaded' },
                });
            }
        });
    }

    private async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();

        this._unwatch = Fs.watchChanges$(path, { delayMs: 1000 })
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe(async () => {
                await this.loadConfig();
                this.appBus.publish({
                    type: 'Notification',
                    path: ['notification'],
                    payload: { header: 'System', body: 'Config loaded' },
                });
            });
    }

    private async loadConfig() {
        this._unwatch?.unsubscribe();

        const configDir = Environment.configDir();
        if (!await Fs.exists(configDir)) {
            await Fs.mkdir(configDir);
        }

        const path = Environment.configFilePath();

        if (!await Fs.exists(path)) {
            // Initiale Config im neuen Format
            const userConfig: Config = {
                shell: {
                    default: '',
                    order: [],
                    profiles: {},
                },
            };

            await this.shells.apply(userConfig);
            await Fs.writeTextFile(path, ConfigWriter.toDotString(userConfig));
        }

        const defaultConfigString = await DefaultConfig.read();
        const userConfigString = await Fs.readTextFile(path);
        const config = ConfigReader.fromStringToConfig(
            defaultConfigString,
            userConfigString
        );

        // Ensure shell integration scripts are installed
        await ShellIntegrationWriter.ensure();

        if (config.enable_watch_config) {
            setTimeout(async () => {
                await this.watch();
            }, 1000);
        }

        this._config.next(config);
        this.appBus.publish({ type: 'ConfigLoaded', path: ['app', 'settings'] });
        Logger.info('Config loaded...');
    }
}


