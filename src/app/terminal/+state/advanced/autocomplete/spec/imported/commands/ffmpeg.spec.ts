import { CommandSpec } from "../../spec.types";

export const FFMPEG_FIG_SPEC: CommandSpec = {
    name: "ffmpeg",
    source: "fig",
    subcommands: [
        "-i",
        "-c:v",
        "-c:a",
        "-vf",
        "-af",
        "-b:v",
        "-b:a",
        "-map",
        "-ss",
        "-t",
        "-y",
        "-hide_banner",
    ],
};

