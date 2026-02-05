import { Injectable } from '@angular/core';
import { Config, ShellConfig, ShellType } from './+models/config';
import { Shell, Shells } from '../_tauri/shells';
import {ShellProfile} from "./+models/shell-config";

@Injectable({ providedIn: 'root' })
export class ShellConfigurator {
    /**
     * Detects available shells and writes them into config.shell.profiles
     * and sets config.shell.default + (optional) config.shell.order.
     */
    async apply(config: Config): Promise<void> {
        const installedShells = await Shells.load();

        // Stable sort order preference
        const weight: Record<ShellType, number> = {
            Fish: 1,
            GitBash: 2,
            PowerShell: 3,
            ZSH: 4,
            Bash: 5,
        };

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
        const base: ShellProfile = {
            shell_type: sh.shell_type,
            path: sh.path,
            args: [],
            env: {},
            working_dir: '~',
            load_user_rc: false,
            enable_shell_integration: true,
            inject_path: true,
        };

        // Note: When enable_shell_integration is true (default),
        // shell args are automatically determined by the integration system.
        // Users can set custom args by disabling shell integration.
        // TERM is set globally in environment_builder.rs for all shells.

        return base;
    }
}
