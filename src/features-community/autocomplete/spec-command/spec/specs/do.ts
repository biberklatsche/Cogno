import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "do",
  description: "Do the command",
  args: {
    isCommand: true,
  },
};

export default completionSpec;
