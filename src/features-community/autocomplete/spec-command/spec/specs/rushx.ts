import { npmScriptsGenerator } from "./npm";
import { yarnScriptParserDirectives } from "./yarn";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "rushx",
  description:
    "Run arbitrary package scripts for rush project. analogous to npm run",
  args: {
    name: "Scripts",
    description: "Script to run from your package.json",
    filterStrategy: "fuzzy",
    generators: npmScriptsGenerator,
    parserDirectives: yarnScriptParserDirectives,
    isCommand: true,
  },
  options: [
    {
      name: ["-h", "--help"],
      description: "Show this help message and exit",
    },
    {
      name: ["-q", "--quiet"],
      description: "Hide rushx startup information",
    },
  ],
};
export default completionSpec;
