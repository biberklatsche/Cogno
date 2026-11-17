import { InvokeArgs, invoke } from "@tauri-apps/api/core";

/**
 * Why a request about a host or its shells failed: the host's own codes
 * (`HostErrorCode` in `cogno-host`) and the app's (`AppErrorCode`). Code
 * decides by these alone; the message is for people and never matched.
 */
const HOST_ERROR_CODES = [
  // The host's.
  "sessionNotFound",
  "attachedElsewhere",
  "sessionClosing",
  "windowClosed",
  "spawnFailed",
  "invalidRequest",
  "unknownRequest",
  "lineEditorUnavailable",
  "processNotFound",
  "notInTerminalTree",
  "noForegroundJob",
  "processesSurvived",
  "io",
  /** A code of a later version. */
  "unknown",
  // The app's.
  "shellAlreadyRuns",
  "connectionLost",
  "notConnected",
  "hostNotStarted",
  "noCognoThere",
  "cognoNotRunning",
  "thisCognoTooOld",
  "hostTooOld",
  "connectFailed",
  "invalidDestination",
  "unexpectedReply",
  "pairingOff",
  "pairingUnreachable",
  "pairingCodeUnknown",
  "pairingDeclined",
  "internal",
] as const;

export type HostErrorCode = (typeof HOST_ERROR_CODES)[number];

const KNOWN_CODES: ReadonlySet<string> = new Set(HOST_ERROR_CODES);

export class HostError extends Error {
  constructor(
    readonly code: HostErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HostError";
  }
}

/** The app's answer to a failed command, as it arrives: `{ code, message }`. */
type CommandErrorContract = { code: string; message: string };

function isCommandError(rejection: unknown): rejection is CommandErrorContract {
  return (
    typeof rejection === "object" &&
    rejection !== null &&
    typeof (rejection as CommandErrorContract).code === "string" &&
    typeof (rejection as CommandErrorContract).message === "string"
  );
}

/**
 * A command's rejection as a `HostError`. A code this build does not know
 * comes from a later app and is `unknown`; a rejection that is no command
 * error at all (the bridge itself failed) is `internal`.
 */
export function toHostError(rejection: unknown): HostError {
  if (rejection instanceof HostError) return rejection;
  if (isCommandError(rejection)) {
    const code = KNOWN_CODES.has(rejection.code) ? (rejection.code as HostErrorCode) : "unknown";
    return new HostError(code, rejection.message);
  }
  const message = rejection instanceof Error ? rejection.message : String(rejection);
  return new HostError("internal", message);
}

/** Whether `error` is a `HostError` with one of `codes`. */
export function isHostError(error: unknown, ...codes: HostErrorCode[]): error is HostError {
  return error instanceof HostError && codes.includes(error.code);
}

/** Runs a command about hosts; a failure arrives as a `HostError`. */
export async function invokeHost<T>(command: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (rejection) {
    throw toHostError(rejection);
  }
}
