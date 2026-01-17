import { Injectable } from '@angular/core';
import {
    Config,
    MAX_SHELL_POSITION,
    ShellConfig,
    ShellConfigPosition,
    ShellType
} from './+models/config';
import {Shell, Shells} from '../_tauri/shells';
import { Environment } from '../common/environment/environment';

@Injectable({ providedIn: 'root' })
export class ShellConfigurator {
  /**
   * Detects available shells and writes them into the config.shell list starting at position 1.
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

    if(config.shell === undefined) {
        config.shell = {};
    }

    let shellPosition: ShellConfigPosition = 1;
    for (const shell of sortedShells) {
        config.shell[shellPosition] = this.createShellConfig(shell);
        shellPosition = shellPosition + 1 as ShellConfigPosition;
        if (shellPosition > MAX_SHELL_POSITION) break;
    }
  }

    private createShellConfig(sh: Shell): ShellConfig {
        const base: ShellConfig = {
            shell_type: sh.shell_type,
            path: sh.path,
            args: [],
            working_dir: '/~',
            enable_shell_integration: true,
            inject_path: true,
        };

        const args: string[] = [];
        //TODO: Add cogno to path during installation
        switch (sh.shell_type) {
            case 'GitBash': {
                args.push('--login', '-i', '-lc');
                const exePath = this.windowsPathToMsys(Environment.exeDirPath());
                const exportCmd = `export PATH='${exePath}':"$PATH"; exec bash -i`;
                args.push(exportCmd);
                break;
            }
            case 'ZSH': {
                args.push('--login', '-i', '-lc');
                const exePath = Environment.exeDirPath();
                const exportCmd = `export PATH='${exePath}':"$PATH"; exec zsh -i`;
                args.push(exportCmd);
                break;
            }
            case 'Bash': {
                args.push('--login', '-i', '-lc');
                const exePath = Environment.exeDirPath();
                const exportCmd = `export PATH='${exePath}':"$PATH"; exec bash -i`;
                args.push(exportCmd);
                break;
            }
            case 'PowerShell': {
                args.push('-NoLogo', '-NoExit', '-Command');
                const exePath = Environment.exeDirPath();
                const exportCmd = `$env:Path = '${exePath};'+$env:Path`;
                args.push(exportCmd);
                break;
            }
            default: {
                // Fallback: no special args
                break;
            }
        }
        return {...base, args};
    }

    private windowsPathToMsys(p: string): string {
    let s = p;
    if (s.startsWith('\\\\?\\')) s = s.slice(4);
    s = s.replace(/\\/g, '/');
    if (s.length >= 2 && s[1] === ':') {
      const drive = s[0].toLowerCase();
      const rest = s.slice(2);
      return `/${drive}${rest}`;
    }
    return s;
  }
}
