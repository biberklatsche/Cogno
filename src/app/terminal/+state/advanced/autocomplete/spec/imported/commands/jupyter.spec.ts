import { CommandSpec } from "../../spec.types";

export const JUPYTER_FIG_SPEC: CommandSpec = {
    name: "jupyter",
    source: "fig",
    subcommands: ["notebook", "lab", "console", "nbconvert", "kernelspec", "server", "--version", "--paths"],
};
