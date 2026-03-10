import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "repeat",
  description:
    "Interpret the result as a number and repeat the commands this many times",
  args: {
    isCommand: true,
  },
};

export default completionSpec;
