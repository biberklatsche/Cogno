// Linux incompatible
import type { CommandSpec } from "../spec.types";
const signals = [
    "hup",
    "int",
    "quit",
    "ill",
    "trap",
    "abrt",
    "emt",
    "fpe",
    "kill",
    "bus",
    "segv",
    "sys",
    "pipe",
    "alrm",
    // This is the default signal
    // "term",
    "urg",
    "stop",
    "tstp",
    "cont",
    "chld",
    "ttin",
    "ttou",
    "io",
    "xcpu",
    "xfsz",
    "vtalrm",
    "prof",
    "winch",
    "info",
    "usr1",
    "usr2"
];
const completionSpec: CommandSpec = {
    name: "killall",
    description: "Kill processes by name",
    options: [
        {
            name: "-d",
            description: "Be verbose (dry run) and display number of user processes"
        },
        {
            name: "-e",
            description: "Use the effective user ID instead of the real user ID for matching processes with -u"
        },
        {
            name: "-help",
            description: "Display help and exit"
        },
        {
            name: "-I",
            description: "Request confirmation before killing each process"
        },
        {
            name: "-l",
            description: "List the names of the available signals and exit"
        },
        {
            name: "-m",
            description: "Match the process name as a regular expression"
        },
        {
            name: "-v",
            description: "Be verbose"
        },
        {
            name: "-s",
            description: "Be verbose (dry run)"
        },
        ...signals.map((signal) => ({
            name: "-SIG" + signal.toUpperCase(),
            description: `Send ${signal.toUpperCase()} instead of TERM`,
        })),
        {
            name: "-u",
            description: "Limit potentially matching processes to those belonging to the user",
            args: {
                name: "user"
            }
        },
        {
            name: "-t",
            description: "Limit matching processes to those running on the specified TTY",
            args: {
                name: "tty"
            }
        },
        {
            name: "-c",
            description: "Limit matching processes to those matching the given name",
            args: {
                name: "name"
            }
        },
        {
            name: "-q",
            description: "Suppress error message if no processes are matched"
        },
        {
            name: "-z",
            description: "Do not skip zombies"
        }
    ]
};
export default completionSpec;
