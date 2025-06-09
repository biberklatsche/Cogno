import {Path} from "../_tauri/path";

export namespace Environment {

    let _cognoDir: string = '';

    export function cognoDir(): string {
        return _cognoDir;
    }

    export async function init() : Promise<void> {
        await Promise.all([_loadConfigDir()])
    }

    async function _loadConfigDir()  {
        _cognoDir = await Path.join(await Path.homeDir(), '.cogno');
    }
}
