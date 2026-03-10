import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "vi",
  description:
    "Vi[m] is an one of two powerhouse text editors in the Unix world, the other being EMACS",
  args: {
    template: "filepaths",
  },
  options: [
    {
      name: ["-h", "--help"],
      description: "Print help message for vi and exit",
    },
  ],
};

export default completionSpec;
