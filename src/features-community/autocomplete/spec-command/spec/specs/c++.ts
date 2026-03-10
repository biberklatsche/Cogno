import clangpp from "./clang++";
const completionSpec: CommandSpec = {
  ...clangpp,
  name: "c++",
  description: "C++ compiler",
};
export default completionSpec;
