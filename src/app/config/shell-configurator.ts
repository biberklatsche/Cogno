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
            GitBash: 1,
            PowerShell: 2,
            ZSH: 3,
            Bash: 4,
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
            // default lassen wir ggf. wie er ist (siehe weiter unten)
        }

        // Optional: nur initial befüllen, wenn noch keine Profile existieren
        // (damit du User-Konfig nicht überschreibst)
        if (Object.keys(config.shell.profiles).length > 0) {
            return;
        }

        const order: string[] = [];

        for (const sh of sortedShells) {
            const name = this.makeUniqueProfileName(config.shell.profiles, sh.shell_type);
            config.shell.profiles[name] = this.createShellConfig(sh);
            order.push(name);
        }

        // Default setzen: wenn leer oder ungültig → erstes Profil
        const hasDefault = !!config.shell.default && !!config.shell.profiles[config.shell.default];
        if (!hasDefault) {
            config.shell.default = order[0] ?? '';
        }

        // order setzen (nur wenn du UI-Reihenfolge brauchst)
        config.shell.order = order;
    }

    private makeUniqueProfileName(
        profiles: Record<string, ShellProfile>,
        shellType: ShellType
    ): string {
        // Basisname aus ShellType (z.B. "ZSH" -> "zsh", "GitBash" -> "gitbash")
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
            working_dir: '/~',
            enable_shell_integration: true,
            inject_path: true,
        };

        const args: string[] = [];
        const env: Record<string, string> = {};

        switch (sh.shell_type) {
            case 'GitBash': {
                args.push('--login', '-i');
                env['TERM'] = 'xterm-256color';
                break;
            }
            case 'ZSH': {
                args.push('--login', '-i');
                break;
            }
            case 'Bash': {
                args.push('--login', '-i');
                break;
            }
            case 'PowerShell': {
                args.push('-NoLogo', '-NoExit');
                break;
            }
            default: {
                break;
            }
        }

        return { ...base, args, env };
    }
}
