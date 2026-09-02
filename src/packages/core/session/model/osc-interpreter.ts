import OscParser from "./osc/cogno-osc.parser";
import { toSessionCapabilities } from "./osc/session-capabilities.parser";
import { SessionModel } from "./session-model";

export type CognoOscResult = "capabilities" | "prompt" | "ignored" | "untrusted";

const CAPS_PREFIX = "COGNO:CAPS;";

/**
 * Reads what the shell integration says on OSC 733 and updates the session
 * model accordingly.
 *
 * `COGNO:CAPS` arrives while the integration script loads, before the first
 * prompt; it records what this session can do. Everything else is a
 * `COGNO:PROMPT`: the previous command is over, and the prompt carries
 * where the shell is and how the command went.
 *
 * Both change the model, so both must prove they come from this session's
 * integration: anything in the pty can print an OSC sequence (a `cat`, a
 * build log, an ssh host), but only the integration knows the session
 * token. A sequence without it is dropped before it touches the model
 * (ARCHITECTURE.md 2.1, "Der Handshake ist authentisiert").
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
      model.updateSessionCapabilities(toSessionCapabilities(kv));
    }
    return "capabilities";
  }

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
