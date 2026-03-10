import { filepaths } from "@fig/autocomplete-generators";

import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
  name: "cd",
  description: "Change the shell working directory",
  args: {
    generators: filepaths({
      showFolders: "only",
      // editFolderSuggestions: {
      //   previewComponent: "cd/folderPreview",
      // },
    }),
    filterStrategy: "fuzzy",
    // Add an additional hidden suggestion so users can execute on it if they want to
    suggestions: [
      {
        name: "-",
        description: "Switch to the last used folder",
        hidden: true,
      },
      {
        name: "~",
        description: "Switch to the home directory",
        hidden: true,
      },
    ],
  },
};

export default completionSpec;
