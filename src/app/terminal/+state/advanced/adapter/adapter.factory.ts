import {ShellType} from '../../../../config/+models/config';
import {Adapter} from './adapter';
import {BashAdapter} from './bash.adapter';
import {FishAdapter} from './fish.adapter';
import {PowerShellAdapter} from './powershell.adapter';
import {ZshAdapter} from './zsh.adapter';

export const AdapterFactory = {
    create(shellType: ShellType): Adapter {
        switch (shellType) {
            case 'GitBash': return new BashAdapter();
            case 'Bash': return new BashAdapter();
            case 'PowerShell': return new PowerShellAdapter();
            case 'ZSH': return new ZshAdapter();
            case 'Fish': return new FishAdapter();
            default : throw new Error('Unknown shell type');
        }
    }
}
