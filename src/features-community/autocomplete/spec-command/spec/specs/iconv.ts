import type { CommandSpec, Generator } from "../spec.types";
const encodingGenerator: Generator = {
    script: ["bash", "-c", "iconv -l | command tr ' ' '\\n' | sort"],
    postProcess: (out) => out.split("\n").map((encoding) => ({
        name: encoding,
        description: encoding,
        type: "arg",
    })),
};
const completionSpec: CommandSpec = {
    name: "iconv",
    description: "Character set conversion",
    options: [
        {
            name: "--help",
            description: "Show help for iconv"
        },
        {
            name: "--version",
            description: "Output version information and exit"
        },
        {
            name: ["-f", "--from-code"],
            description: "Specifies the encoding of the input",
            args: {
                name: "encoding"
            }
        },
        {
            name: ["-t", "--to-code"],
            description: "Specifies the encoding of the output",
            args: {
                name: "encoding"
            }
        },
        {
            name: "-c",
            description: "Discard unconvertible characters"
        },
        {
            name: ["-l", "--list"],
            description: "List the supported encodings"
        },
        {
            name: "--unicode-subst",
            description: "Substitution for unconvertible Unicode characters",
            args: {
                name: "FORMATSTRING",
                description: "The formatstring must be a format string in the same format as for the printf command"
            }
        },
        {
            name: "--byte-subst",
            description: "Substitution for unconvertible bytes",
            args: {
                name: "FORMATSTRING",
                description: "The formatstring must be a format string in the same format as for the printf command"
            }
        },
        {
            name: "--widechar-subst",
            description: "Substitution for unconvertible wide characters",
            args: {
                name: "FORMATSTRING",
                description: "The formatstring must be a format string in the same format as for the printf command"
            }
        }
    ]
};
export default completionSpec;
