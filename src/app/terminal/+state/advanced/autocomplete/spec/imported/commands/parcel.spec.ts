import { CommandSpec } from "../../spec.types";

export const PARCEL_FIG_SPEC: CommandSpec = {
    name: "parcel",
    source: "fig",
    subcommands: ["serve", "build", "watch", "--port", "--host", "--dist-dir", "--no-cache", "--target"],
};
