
import {type as tauriType} from '@tauri-apps/plugin-os';

export type OsType = "linux" | "windows" | "macos";

export namespace OS {
  export const platform= (): OsType => {
     const t = tauriType();
     switch (t) {
         case "linux": return "linux";
         case "windows": return "windows";
         case "macos": return "macos";
         default: throw Error(`Unknown OS type: ${t}`);
     }
  };
}
