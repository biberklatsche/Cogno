import serverless from "./serverless";
const completionSpec: CommandSpec = {
  ...serverless,
  name: "sls",
};
export default completionSpec;
