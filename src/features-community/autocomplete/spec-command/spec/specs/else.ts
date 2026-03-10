import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "else",
  description: "Execute this command if the test returned 1",
  args: {
    isCommand: true,
  },
};

export default completionSpec;
