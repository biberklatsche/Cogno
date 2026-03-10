import {
import type { CommandSpec, SubcommandSpec } from "../spec.types";
  clangBase,
  stdCPPSuggestions,
  stdOpenCLCPPSuggestions,
  stdHLSLSuggestions,
} from "./clang";

const completionSpec: CommandSpec = {
  ...clangBase,
  name: "clang++",
  description: "Clang LLVM compiler for C++",
  options: [
    ...(clangBase as SubcommandSpec).options,
    {
      name: "-std",
      description: "Language standard to compile for",
      args: {
        name: "value",
        suggestions: [
          ...stdCPPSuggestions,
          ...stdOpenCLCPPSuggestions,
          {
            name: "cuda",
            description: "NVIDIA CUDA(tm)",
          },
          {
            name: "hip",
            description: "HIP",
          },
          ...stdHLSLSuggestions,
        ],
      },
      requiresSeparator: true,
    },
  ],
};
export default completionSpec;
