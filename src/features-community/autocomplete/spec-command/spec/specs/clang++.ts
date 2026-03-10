import type { CommandSpec, SubcommandSpec } from "../spec.types";
import { clangBase, stdCPPSuggestions, stdHLSLSuggestions, stdOpenCLCPPSuggestions } from "./clang";
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
                name: "value"
            }
        }
    ]
};
export default completionSpec;
