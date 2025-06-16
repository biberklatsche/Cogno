
import {Platform as tauriPlatformType, platform as tauriPlatform} from '@tauri-apps/plugin-os';

export type Platform = tauriPlatformType

export namespace OS {
  export const platform= (): Platform => tauriPlatform();
}
