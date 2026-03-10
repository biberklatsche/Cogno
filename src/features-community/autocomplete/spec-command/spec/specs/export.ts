import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "export",
  description: "Export variables",
  hidden: true,
  args: {
    isVariadic: true,
  },
};

export default completionSpec;
