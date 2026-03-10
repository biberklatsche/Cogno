import clangpp from "./clang++";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...clangpp,
  name: "c++",
  description: "C++ compiler",
};
export default completionSpec;
