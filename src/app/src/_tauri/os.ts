
import {type as tauriType} from '@tauri-apps/plugin-os';

export type OsType = "linux" | "windows" | "macos";

export const OS = {
  platform(): OsType {
     const t = tauriType();
     switch (t) {
         case "linux": return "linux";
         case "windows": return "windows";
         case "macos": return "macos";
         default: throw Error(`Unknown OS type: ${t}`);
     }
  }
}
