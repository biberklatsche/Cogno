import OscParser from "./osc/cogno-osc.parser";
import { toSessionCapabilities } from "./osc/session-capabilities.parser";
import { SessionModel } from "./session-model";

export type CognoOscResult = "capabilities" | "prompt" | "ignored";

const CAPS_PREFIX = "COGNO:CAPS;";

/**
 * Reads what the shell integration says on OSC 733 and updates the session
 * model accordingly.
 *
 * `COGNO:CAPS` arrives once while the integration script loads, before the
 * first prompt; it only records what this session can do. Everything else is
 * a `COGNO:PROMPT`: the previous command is over, and the prompt carries
 * where the shell is and how the command went.
 */
export function interpretCognoOsc(data: string, model: SessionModel): CognoOscResult {
  if (data.startsWith(CAPS_PREFIX)) {
    const caps = OscParser.parse(data.slice(CAPS_PREFIX.length));
    if (caps) {
      model.updateSessionCapabilities(toSessionCapabilities(caps));
    }
    return "capabilities";
  }

  model.endCommand();
  model.report({ type: "promptReported" });
  const kv = OscParser.parse(data);
  if (!kv) return "ignored";
  kv["duration"] = model.getCommandDuration()?.toString() ?? "";
  model.updateCommand(kv);
  const directory = kv["directory"];
  if (directory?.trim()) {
    model.updateCwd(directory);
  }
  return "prompt";
}
