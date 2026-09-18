import OscParser from "./osc/cogno-osc.parser";
import { toSessionCapabilities } from "./osc/session-capabilities.parser";
import { SessionModel } from "./session-model";

export type CognoOscResult = "capabilities" | "prompt" | "ignored" | "untrusted";

const CAPS_PREFIX = "COGNO:CAPS;";

/**
 * Reads what the shell integration says on OSC 733 and updates the session
 * model accordingly.
 *
 * `COGNO:CAPS` records what the shell can do and, through the context
 * timeline, which shell it is: a handshake while a command runs is a new
 * inner context (`wsl`, `ssh` with the integration), otherwise it
 * re-handshakes the current one. `COGNO:PROMPT` ends the running command -
 * and if that command had opened an inner context, the prompt is the outer
 * shell's, so the context returns first.
 *
 * Both change the model, so both must prove they come from this session's
 * integration: anything in the pty can print an OSC sequence, but only the
 * integration knows the session token. A sequence without it is dropped
 * before it touches the model (ARCHITECTURE.md 2.1).
 */
export function interpretCognoOsc(data: string, model: SessionModel): CognoOscResult {
  const isCaps = data.startsWith(CAPS_PREFIX);
  const kv = OscParser.parse(isCaps ? data.slice(CAPS_PREFIX.length) : data);

  const expectedToken = model.sessionToken;
  if (expectedToken !== undefined && kv?.["token"] !== expectedToken) {
    model.recordUntrustedSequence();
    return "untrusted";
  }

  if (isCaps) {
    if (kv) {
      model.applyHandshake(toSessionCapabilities(kv), {
        shell: kv["shell"],
        os: kv["os"],
        distro: kv["distro"],
      });
    }
    return "capabilities";
  }

  model.onPromptBeforeCommandEnd();
  model.endCommand();
  model.report({ type: "promptReported" });
  if (!kv) return "ignored";
  kv["duration"] = model.getCommandDuration()?.toString() ?? "";
  model.updateCommand(kv);
  const directory = kv["directory"];
  if (directory?.trim()) {
    model.updateCwd(directory);
  }
  return "prompt";
}
