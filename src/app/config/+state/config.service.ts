import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {BehaviorSubject, debounceTime, filter, map, Observable, Subject} from 'rxjs';
import {Config, ShellType, Theme} from "../+models/config";
import {ConfigCodec} from "./config.codec";
import {ConfigLoadedEvent, ThemeChangedEvent} from "../+bus/events";
import {Logger} from "../../_tauri/logger";
import {AppBus} from "../../app-bus/app-bus";
import {invoke} from "@tauri-apps/api/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private _config: BehaviorSubject<Config | undefined> = new BehaviorSubject<Config | undefined>(undefined);

    get config(): Config {
        if(this._config === undefined) throw new Error('Config is not loaded!');
        return this._config.value!;
    }

    get config$(): Observable<Config> {
        return this._config.pipe(filter(s => !!s));
    }

    get activeTheme$(): Observable<Theme & { scrollbackLines: number }> {
        return this.config$.pipe(map(s => {
            return {...s.theme.default, scrollbackLines: s.general.scrollback_lines};
        }));
    }

    constructor(private appBus: AppBus, private destroy: DestroyRef) {
        appBus.onType$('LoadConfigCommand').pipe(takeUntilDestroyed(destroy)).subscribe(async () => {
            await this.loadConfig();
        });
        appBus.onceType$('WatchConfigCommand').subscribe(() => {
            setTimeout(async () => await this.watch(), 1000);
        });
    }

    private async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();
        const unwatch = Fs.watchChanges$(path).pipe(debounceTime(50)).subscribe(async () => {
            await this.loadConfig();
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe());
    }

    private async loadConfig() {
        const path = Environment.configFilePath();
        if(!await Fs.exists(path)) {
            await Fs.writeTextFile(path, ConfigCodec.defaultSettingsAsComment());
            const configAsString = await Fs.readTextFile(path);
            const config = ConfigCodec.fromStringToConfig(configAsString);
            await this.setShells(config);
            await Fs.appendTextFile(path, ConfigCodec.diffToString(config));
        }
        const configAsString = await Fs.readTextFile(path);
        const config = ConfigCodec.fromStringToConfig(configAsString);
        this._config.next(config);

        const configLoadedEvent: ConfigLoadedEvent = {type: 'ConfigLoaded', sourcePath: ['app', 'settings']};
        const themeChangedEvent: ThemeChangedEvent = {type: 'ThemeChanged', sourcePath: ['app', 'settings']};
        this.appBus.publish(configLoadedEvent);
        this.appBus.publish(themeChangedEvent);
        Logger.info('Config loaded...');
    }

    private async setShells(config: Config) {
        const shells = await invoke<{name: string, path: string, shell_type: ShellType}[]>("list_shells");
        const zsh = shells.find(s => s.shell_type === 'ZSH');
        if(zsh) {
            config.shell[1] = {
                    name: "ZSH",
                    shell_type: zsh.shell_type,
                    prompt_version: "version1",
                    path: zsh.path,
                    args: [
                        "--login",
                        "-i"
                    ],
                    working_dir:"/~",
                    start_timeout: 100000,
                    prompt_terminator: "🖕",
                    uses_final_space_prompt_terminator: true,
                    injection_type: "manual",
                    is_debug_mode_enabled: false
            }
            return;
        }
        const gitbash = shells.find(s => s.shell_type === 'GitBash');
        if(gitbash) {
            config.shell[1] = {
                name: "GitBash",
                shell_type: gitbash.shell_type,
                prompt_version: "version1",
                path: gitbash.path,
                args: [
                    "--login",
                    "-i"
                ],
                working_dir:"/~",
                start_timeout: 100000,
                prompt_terminator: "🖕",
                uses_final_space_prompt_terminator: true,
                injection_type: "manual",
                is_debug_mode_enabled: false
            }
            return;
        }
        const powershell = shells.find(s => s.shell_type === 'Powershell');
        if(powershell) {
            config.shell[1] = {
                name: "Powershell",
                shell_type: powershell.shell_type,
                prompt_version: "version1",
                path: powershell.path,
                args: [
                    "--login",
                    "-i"
                ],
                working_dir:"/~",
                start_timeout: 100000,
                prompt_terminator: "🖕",
                uses_final_space_prompt_terminator: true,
                injection_type: "manual",
                is_debug_mode_enabled: false
            }
            return;
        }
        const bash = shells.find(s => s.shell_type === 'Bash');
        if(bash) {
            config.shell[1] = {
                name: "Bash",
                shell_type: bash.shell_type,
                prompt_version: "version1",
                path: bash.path,
                args: [
                    "--login",
                    "-i"
                ],
                working_dir:"/~",
                start_timeout: 100000,
                prompt_terminator: "🖕",
                uses_final_space_prompt_terminator: true,
                injection_type: "manual",
                is_debug_mode_enabled: false
            }
            return;
        }
    }
}
