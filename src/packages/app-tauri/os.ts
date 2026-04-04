import {type as tauriType} from '@tauri-apps/plugin-os';

export type OsType = "linux" | "windows" | "macos";

function mapPlatformName(platformName: string | undefined): OsType | undefined {
  switch (platformName) {
    case "linux":
    case "windows":
    case "macos":
      return platformName;
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return undefined;
  }
}

function getFallbackPlatform(): OsType {
  const processPlatform = (globalThis as { process?: { platform?: string } }).process?.platform;
  const mappedProcessPlatform = mapPlatformName(processPlatform);
  if (mappedProcessPlatform) {
    return mappedProcessPlatform;
  }

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  if (userAgent.includes("mac")) {
    return "macos";
  }
  if (userAgent.includes("win")) {
    return "windows";
  }
  return "linux";
}

export const OS = {
  platform(): OsType {
     try {
       const rawPlatform = tauriType();
       const platform = mapPlatformName(rawPlatform);
       if (platform) {
         return platform;
       }
       throw Error(`Unknown OS type: ${rawPlatform}`);
     } catch {
       return getFallbackPlatform();
     }
  }
}
