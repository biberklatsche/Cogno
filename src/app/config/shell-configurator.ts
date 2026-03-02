import { Injectable } from '@angular/core';
import { Config, ShellType } from './+models/config';
import { Shell, Shells } from '../_tauri/shells';
import {ShellProfile} from "./+models/shell-config";
import {OS, OsType} from "../_tauri/os";

@Injectable({ providedIn: 'root' })
export class ShellConfigurator {

    private readonly shellOrderPerOs: Record<OsType, Record<ShellType, number>> = {
        macos: {
            Fish: 1,
            ZSH: 2,
            Bash: 3,
            PowerShell: 4,
            GitBash: 5,
        },
        windows: {
            PowerShell: 1,
            GitBash: 2,
            Bash: 3,
            ZSH: 4,
            Fish: 5,
        },
        linux: {
            Fish: 1,
            ZSH: 2,
            Bash: 3,
            PowerShell: 4,
            GitBash: 5,
        },
    };

    /**
     * Detects available shells and writes them into config.shell.profiles
     * and sets config.shell.default + (optional) config.shell.order.
     */
    async apply(config: Config): Promise<void> {
        const installedShells = await Shells.load();

        const weight: Record<ShellType, number> = this.shellOrderPerOs[OS.platform()];

        const sortedShells = installedShells.sort((a, b) => {
            const wa = weight[a.shell_type] ?? 99;
            const wb = weight[b.shell_type] ?? 99;
            return wa - wb;
        });

        // Ensure new structure exists
        if (!config.shell) {
            config.shell = {
                default: '',
                order: [],
                profiles: {},
            };
        } else {
            config.shell.profiles ??= {};
            config.shell.order ??= [];
            // Leave default as it is (see below)
        }

        // Optional: only populate initially if no profiles exist yet
        // (to avoid overwriting user configuration)
        if (Object.keys(config.shell.profiles).length > 0) {
            return;
        }

        const order: string[] = [];

        for (const sh of sortedShells) {
            const name = this.makeUniqueProfileName(config.shell.profiles, sh.shell_type);
            config.shell.profiles[name] = this.createShellConfig(sh);
            order.push(name);
        }

        // Set default: if empty or invalid → first profile
        const hasDefault = !!config.shell.default && !!config.shell.profiles[config.shell.default];
        if (!hasDefault) {
            config.shell.default = order[0] ?? '';
        }

        // set order (only if you need UI order)
        config.shell.order = order;
    }

    private makeUniqueProfileName(
        profiles: Record<string, ShellProfile>,
        shellType: ShellType
    ): string {
        // Base name from ShellType (e.g., "ZSH" -> "zsh", "GitBash" -> "gitbash")
        const base = shellType.toLowerCase();

        if (!profiles[base]) return base;

        // Kollisionsfrei: zsh2, zsh3, ...
        let i = 2;
        while (profiles[`${base}${i}`]) i++;
        return `${base}${i}`;
    }

    private createShellConfig(sh: Shell): ShellProfile {
        // Determine default args based on shell type for login shell + integration
        let args: string[] = [];

        switch (sh.shell_type) {
            case 'Bash':
            case 'GitBash':
                // Note: --rcfile (added by integration) implies interactive mode
                // Don't add -i here, it will be automatically interactive
                args = [];
                break;
            case 'ZSH':
                args = ['-l', '-i'];
                break;
            case 'Fish':
                args = ['-l'];
                break;
            case 'PowerShell':
                args = ['-NoLogo'];
                break;
        }

        const base: ShellProfile = {
            shell_type: sh.shell_type,
            path: sh.path,
            args: args,
            env: {},
            working_dir: '~',
            load_user_rc: true,
            enable_shell_integration: true,
            inject_cogno_cli: true,
        };

        // TERM is set globally in environment_builder.rs for all shells.

        return base;
    }
}
