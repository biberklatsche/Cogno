import { Injectable } from '@angular/core';
import { Config, ShellConfig, ShellType } from './+models/config';
import { Shells } from '../_tauri/shells';
import { Environment } from '../common/environment/environment';

@Injectable({ providedIn: 'root' })
export class ShellConfigurator {
  /**
   * Detects available shells and writes them into the config.shell list starting at position 1.
   */
  async apply(config: Config): Promise<void> {
    const shells = await Shells.load();

    // Stable sort order preference
    const weight: Record<ShellType, number> = {
      ZSH: 1,
      Bash: 2,
      GitBash: 3,
      Powershell: 4,
    };

    const sorted = [...shells].sort((a, b) => {
      const wa = weight[a.shell_type as ShellType] ?? 99;
      const wb = weight[b.shell_type as ShellType] ?? 99;
      return wa - wb;
    });

    let pos = 1 as keyof typeof config.shell;

    for (const sh of sorted) {
      const base: ShellConfig = {
        name: sh.name || sh.shell_type,
        shell_type: sh.shell_type as ShellType,
        prompt_version: 'version1',
        path: sh.path,
        args: [],
        working_dir: '/~',
        start_timeout: 100000,
        prompt_terminator: '🖕',
        uses_final_space_prompt_terminator: true,
        injection_type: 'manual',
        is_debug_mode_enabled: false,
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
        case 'Powershell': {
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
