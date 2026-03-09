export type { ShellContext } from "@cogno/core-host";
export { isWslContext } from "@cogno/core-host";

export type CognoOscDataType = 'id' | 'directory' | 'user' | 'machine' | 'returnCode' | 'commandExists';
export type OscDataType = CognoOscDataType | string;
