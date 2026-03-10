import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "nano",
  description: "Nano's ANOther editor, an enhanced free Pico clone",
  args: {
    template: "filepaths",
  },
};

export default completionSpec;
