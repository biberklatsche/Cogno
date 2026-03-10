import serverless from "./serverless";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  ...serverless,
  name: "sls",
};
export default completionSpec;
