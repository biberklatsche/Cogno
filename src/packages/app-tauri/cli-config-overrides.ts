import { invoke } from "@tauri-apps/api/core";

export const CliConfigOverrides = {
    getSerializedOverrides(): Promise<string | null> {
        return invoke<string | null>("get_cli_config_set_overrides");
    }
};


