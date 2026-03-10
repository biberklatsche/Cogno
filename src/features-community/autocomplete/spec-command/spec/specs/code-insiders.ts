import code from "./code";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...code,
  name: "code-insiders",
};

export default completionSpec;
