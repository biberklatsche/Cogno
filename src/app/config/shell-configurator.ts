import { Injectable } from '@angular/core';
import { ConfigTypes, ShellConfig, ShellType } from './+models/config.types';
import { Shells } from '../_tauri/shells';
import { Environment } from '../common/environment/environment';

@Injectable({ providedIn: 'root' })
export class ShellConfigurator {
  /**
   * Detects available shells and writes them into the config.shell list starting at position 1.
   */
  async apply(config: ConfigTypes): Promise<void> {
    const shells = await Shells.load();

    // Stable sort order preference
    const weight: Record<ShellType, number> = {
        GitBash: 1,
        PowerShell: 2,
        ZSH: 3,
        Bash: 4,
    };

    const sorted = [...shells].sort((a, b) => {
      const wa = weight[a.shell_type as ShellType] ?? 99;
      const wb = weight[b.shell_type as ShellType] ?? 99;
      return wa - wb;
    });

    let pos = 1 as keyof typeof config.shell;

    for (const sh of sorted) {
      const base: ShellConfig = {
        shell_type: sh.shell_type as ShellType,
        path: sh.path,
        args: [],
        working_dir: '/~',
      } as any;

      const args: string[] = [];

      switch (sh.shell_type) {
        case 'GitBash': {
          args.push('--login', '-i', '-lc');
          const exePath = this.windowsPathToMsys(Environment.exeDirPath());
          const exportCmd = `export PATH='${exePath}':"$PATH"; exec bash -i`;
          args.push(exportCmd);
          break;
        }
        case 'ZSH':{
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

      // assign into next available position
      (config.shell as any)[pos] = { ...base, args };
      // increment position until 20
      // @ts-ignore numeric increment across union type
      pos = (pos + 1);
      if (pos > 20) break;
    }
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
