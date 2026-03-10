import capacitor from "./capacitor";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...capacitor,
  name: "cap",
};

export default completionSpec;
