import {invoke} from "@tauri-apps/api/core";

export const DefaultConfig = {

    read():Promise<string> {return invoke<string>("get_default_config")},
}

