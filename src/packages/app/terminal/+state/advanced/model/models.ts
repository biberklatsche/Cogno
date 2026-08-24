export type { ResolvedShellContextContract as ShellContext } from "@cogno/shared/domain";
export { isWslShellContext as isWslContext } from "@cogno/shared/domain";

export type CognoOscDataType =
  | "id"
  | "directory"
  | "user"
  | "machine"
  | "returnCode"
  | "commandExists";
export type OscDataType = CognoOscDataType | string;
