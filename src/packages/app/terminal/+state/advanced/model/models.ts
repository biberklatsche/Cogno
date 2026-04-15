export type { ResolvedShellContextContract as ShellContext } from "@cogno/core-api";
export { isWslShellContext as isWslContext } from "@cogno/core-api";

export type CognoOscDataType =
  | "id"
  | "directory"
  | "user"
  | "machine"
  | "returnCode"
  | "commandExists";
export type OscDataType = CognoOscDataType | string;
