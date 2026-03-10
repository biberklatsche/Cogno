import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "if",
  description: "Conditionally execute based on the return value of a command",
  args: {
    isCommand: true,
  },
};

export default completionSpec;
