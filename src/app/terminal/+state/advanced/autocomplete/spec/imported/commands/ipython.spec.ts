import { CommandSpec } from "../../spec.types";

export const IPYTHON_FIG_SPEC: CommandSpec = {
    name: "ipython",
    source: "fig",
    subcommands: ["--profile", "--matplotlib", "--pdb", "--ext", "--TerminalIPythonApp.display_banner"],
};
