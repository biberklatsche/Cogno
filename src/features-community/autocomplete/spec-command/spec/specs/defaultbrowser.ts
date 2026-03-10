import type { CommandSpec, Generator } from "../spec.types";
const getInstalledBrowsers: Generator = {
  script: ["defaultbrowser"],
  postProcess: function (out) {
    return out.split("\n").map((line) => {
      /* We ignore the already set browser */
      if (line.startsWith("*")) {
        return {};
      }
      const browserName = line.trim();
      return {
        name: browserName,
      };
    });
  },
};

const completionSpec: CommandSpec = {
  name: "defaultbrowser",
  description: "Change your default browser from the CLI",
  args: { isOptional: true, generators: getInstalledBrowsers },
};

export default completionSpec;
