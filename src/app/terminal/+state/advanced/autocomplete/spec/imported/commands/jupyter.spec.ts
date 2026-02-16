import { CommandSpec } from "../../spec.types";

export const JUPYTER_FIG_SPEC: CommandSpec = {
    name: "jupyter",
    source: "fig",
    subcommands: ["notebook", "lab", "console", "nbconvert", "kernelspec", "server", "--version", "--paths"],
    subcommandOptions: {
        notebook: ["--no-browser", "--port", "--ip", "--NotebookApp.token="],
        lab: ["--no-browser", "--port", "--ip", "--LabApp.token="],
    },
};
