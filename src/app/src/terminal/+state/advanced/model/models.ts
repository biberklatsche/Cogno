export type { ResolvedShellContextContract as ShellContext } from "@cogno/core-sdk";
export { isWslShellContext as isWslContext } from "@cogno/core-sdk";

export type CognoOscDataType = 'id' | 'directory' | 'user' | 'machine' | 'returnCode' | 'commandExists';
export type OscDataType = CognoOscDataType | string;
