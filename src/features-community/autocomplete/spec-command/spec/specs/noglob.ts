import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "noglob",
  description: "ZSH pre-command modifier that disables glob expansion",
  hidden: true,
  args: {
    isCommand: true,
  },
};

export default completionSpec;
