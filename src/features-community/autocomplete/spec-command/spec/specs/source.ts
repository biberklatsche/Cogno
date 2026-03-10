import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "source",
  description: "Source files in shell",
  args: {
    isVariadic: true,
    name: "File to source",
    template: "filepaths",
  },
};

export default completionSpec;
