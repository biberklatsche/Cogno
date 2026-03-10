import { gccBase } from "./gcc";
import { stdCPPSuggestions } from "./clang";

const completionSpec: CommandSpec = {
  ...gccBase,
  name: "g++",
  description: "The default C++ compiler for most linux distributions",
  options: [
    ...(gccBase as SubcommandSpec).options,
    {
      name: "-std",
      description: "Language standard to compile for",
      args: {
        name: "value",
        suggestions: [...stdCPPSuggestions],
      },
      requiresSeparator: true,
    },
  ],
};
export default completionSpec;
