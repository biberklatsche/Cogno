import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "time",
  description: "Time how long a command takes!",
  args: {
    isCommand: true,
  },
};

export default completionSpec;
