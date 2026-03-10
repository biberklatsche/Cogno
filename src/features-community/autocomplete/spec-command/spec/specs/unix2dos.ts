import dos2unix from "./dos2unix";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...dos2unix,
  name: "unix2dos",
  description: "Unix to DOS text file format convertor",
};
export default completionSpec;
