import {TerminalTab} from '../+models/tab';
import {ShellConfig} from '../../settings/+models/settings';

export namespace TabnameBuilder {
  export function create(data: {directory?: string[], command?: string}, tab: TerminalTab): Pick<TerminalTab, 'name' | 'subName' | 'path'> {
    if (data.command) {
      return TabnameBuilder.createCommandTabName(data.command, data.directory, tab.config);
    } else {
      return TabnameBuilder.createDirectoryTabName(data.directory, tab.config);
    }
  }

  export function createDirectoryTabName(directory: string[], shellConfig: ShellConfig): Pick<TerminalTab, 'name' | 'subName' | 'path'> {
    return {name: Path.toShellPath(directory, shellConfig?.type)}
  }

  export function createCommandTabName(command: string, directory: string[], shellConfig: ShellConfig): Pick<TerminalTab, 'name' | 'subName' | 'path'> {
    const osPath = Path.toShellPath(directory, shellConfig?.type);
    const dir = path.basename(osPath);
    return {name: command, subName: dir.length > 0 ? dir : osPath, path: osPath};
  }
}
