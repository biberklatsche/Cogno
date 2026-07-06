import {
  SHELL_LINE_EDITOR_ACTIONS,
  ShellLineEditorActionContract,
  ShellSessionCapabilitiesContract,
} from "@cogno/core-api";

/**
 * Maps the key/value pairs of a `COGNO:CAPS` handshake payload to the session
 * capabilities contract. Unknown action names are dropped so a newer
 * integration script can never make the app call an action it doesn't know.
 */
export function toSessionCapabilities(
  kv: Record<string, string>,
): ShellSessionCapabilitiesContract {
  const knownActions: ReadonlyArray<string> = SHELL_LINE_EDITOR_ACTIONS;
  const nativeActions = (kv["nativeActions"] ?? "")
    .split(",")
    .map((action) => action.trim())
    .filter((action): action is ShellLineEditorActionContract => knownActions.includes(action));

  return {
    shellVersion: kv["shellVersion"]?.trim() || undefined,
    nativeActions,
    bracketedPaste: kv["bracketedPaste"] === "true",
    degradedReason: kv["degraded"]?.trim() || undefined,
  };
}
