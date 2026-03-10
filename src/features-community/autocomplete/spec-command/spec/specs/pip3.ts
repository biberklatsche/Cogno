import pipCompletionSpec from "./pip";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...pipCompletionSpec,
  name: "pip3",
};

export default completionSpec;
