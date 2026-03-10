import type { CommandSpec, Suggestion } from "../spec.types";
const convValues: Suggestion[] = [
    {
        name: "ascii",
        icon: "fig://icon?type=string",
        description: "The same as 'unblock' except characters are translated from EBCDIC to ASCII",
    },
    {
        name: "oldascii",
        icon: "fig://icon?type=string",
        description: "The same as 'unblock' except characters are translated from EBCDIC to ASCII",
    },
    {
        name: "block",
        icon: "fig://icon?type=string",
        description: "Treats the input as a sequence of newline or EOF-terminated variable length records of independent input and output block boundaries",
    },
    {
        name: "ebcdic",
        icon: "fig://icon?type=string",
        description: "The same as the 'block' value except that characters are translated from ASCII to EBCDIC after the records are converted",
    },
    {
        name: "ibm",
        icon: "fig://icon?type=string",
        description: "The same as the 'block' value except that characters are translated from ASCII to EBCDIC after the records are converted",
    },
    {
        name: "oldebcdic",
        icon: "fig://icon?type=string",
        description: "The same as the 'block' value except that characters are translated from ASCII to EBCDIC after the records are converted",
    },
    {
        name: "oldibm",
        icon: "fig://icon?type=string",
        description: "The same as the 'block' value except that characters are translated from ASCII to EBCDIC after the records are converted",
    },
    {
        name: "lcase",
        icon: "fig://icon?type=string",
        description: "Transform uppercase characters into lowercase characters",
    },
    {
        name: "noerror",
        icon: "fig://icon?type=string",
        description: "Do not stop processing on an input error",
    },
    {
        name: "notrunc",
        icon: "fig://icon?type=string",
        description: "Do not truncate the output file. This will preserve any blocks in the output file not explicitly written by dd",
    },
    {
        name: "osync",
        icon: "fig://icon?type=string",
        description: "Pad the final output block to the full output block size",
    },
    {
        name: "sparse",
        icon: "fig://icon?type=string",
        description: "If one or more output blocks would consist solely of NUL bytes, try to seek the output file by the required space instead of filling them with NULs, resulting in a sparse file",
    },
    {
        name: "swab",
        icon: "fig://icon?type=string",
        description: "Swap every pair of input bytes",
    },
    {
        name: "sync",
        icon: "fig://icon?type=string",
        description: "Pad every input block to the input buffer size",
    },
    {
        name: "ucase",
        icon: "fig://icon?type=string",
        description: "Transform lowercase characters into uppercase characters",
    },
    {
        name: "unblock",
        icon: "fig://icon?type=string",
        description: "Treats the input as a sequence of fixed length records independent of input and output block boundaries",
    }
];
const completionSpec: CommandSpec = {
    name: "dd",
    description: "Convert and copy a file",
    // dd has "operands", which are most closely modeled as options in a Fig spec.
    // Asterisk *feels* a lot better than the default option icon here.
    options: [
        {
            name: "bs",
            description: "Set input and output block size",
            args: {
                name: "size"
            }
        },
        {
            name: "cbs",
            description: "Set the conversion record size",
            args: {
                name: "size"
            }
        },
        {
            name: "count",
            description: "Copy this many input blocks",
            args: {
                name: "number"
            }
        },
        {
            name: "files",
            description: "Copy this many files before terminating",
            args: {
                name: "number"
            }
        },
        {
            name: "ibs",
            description: "Set the input block size",
            args: {
                name: "size"
            }
        },
        {
            name: "if",
            description: "Read an input file instead of stdin",
            args: {
                name: "file"
            }
        },
        {
            name: "iseek",
            description: "Seek this many blocks on the input file",
            args: {
                name: "blocks"
            }
        },
        {
            name: "obs",
            description: "Set the output block size",
            args: {
                name: "size"
            }
        },
        {
            name: "of",
            description: "Write to an output file instead of stdout",
            args: {
                name: "file"
            }
        },
        {
            name: "oseek",
            description: "Seek this many blocks on the output file",
            args: {
                name: "blocks"
            }
        },
        {
            name: "seek",
            description: "Seek this many blocks from the beginning of the output before copying",
            args: {
                name: "blocks"
            }
        },
        {
            name: "skip",
            description: "Skip this many blocks from the beginning of the input before copying",
            args: {
                name: "blocks"
            }
        },
        {
            name: "conv",
            description: "Convert input data (comma-separated list)",
            args: {
                name: "value"
            }
        }
    ]
};
export default completionSpec;
