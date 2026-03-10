import { filepaths } from "@fig/autocomplete-generators";
import type { CommandSpec } from "../spec.types";
const completionSpec: CommandSpec = {
    name: "julia",
    description: "The Julia Programming Language",
    options: [
        {
            name: ["-v", "--version"],
            description: "Display version information"
        },
        {
            name: ["-h", "--help"],
            description: "Print help message for julia (--help-hidden for more)"
        },
        {
            name: "--help-hidden",
            description: "Uncommon options not shown by `-h`"
        },
        // startup options
        {
            name: "--project",
            description: "Set given directory as the home project/environment",
            args: {
                name: "project folder",
                description: "Julia project/environment"
            }
        },
        {
            name: ["-J", "--sysimage"],
            description: "Start up with the given system image file",
            args: {
                name: "system image"
            }
        },
        {
            name: ["-H", "--home"],
            description: "Set location of `julia` executable"
        },
        {
            name: "--startup-file",
            description: "Load `~/.julia/config/startup.jl`"
        },
        {
            name: "--handle-signals",
            description: "Enable or disable Julia's default signal handlers"
        },
        {
            name: "--sysimage-native-code",
            description: "Use native code from system image if available"
        },
        {
            name: "--compiled-modules",
            description: "Enable or disable incremental precompilation of modules"
        },
        // actions
        {
            name: ["-e", "--eval"],
            description: "Evaluate given expr",
            args: {
                name: "expr"
            }
        },
        {
            name: ["-E", "--print"],
            description: "Evaluate given expr and display the result",
            args: {
                name: "expr"
            }
        },
        {
            name: ["-L", "--load"],
            description: "Load given file immediately on all processors",
            args: {
                name: "julia script"
            }
        },
        // parallel options
        {
            name: ["-t", "--threads"],
            description: 'Enable N threads; "auto" sets N to the number of local CPU threads'
        },
        {
            name: ["-p", "--procs"],
            description: 'Integer value N launches N additional local worker processes "auto" launches as many workers as the number of local CPU threads'
        },
        {
            name: "--machine-file",
            description: "Run processes on hosts listed in given file"
        },
        // interactive options
        {
            name: "-i",
            description: "Interactive mode; REPL runs and isinteractive() is true"
        },
        {
            name: ["-q", "--quiet"],
            description: "Quiet startup: no banner, suppress REPL warnings"
        },
        {
            name: "--banner",
            description: "Enable or disable startup banner"
        },
        {
            name: "--color",
            description: "Enable or disable color text"
        },
        {
            name: "--history-file",
            description: "Load or save history"
        },
        // error and warning options
        {
            name: "--depwarn",
            description: 'Enable or disable syntax and method deprecation warnings ("error" turns warnings into errors)'
        },
        {
            name: "--warn-overwrite",
            description: "Enable or disable method overwrite warnings"
        },
        {
            name: "--warn-scope",
            description: "Enable or disable warning for ambiguous top-level scope"
        },
        // code generation options
        {
            name: ["-C", "--cpu-target"],
            description: 'Limit usage of CPU features up to <target>; set to "help" to see the available options'
        },
        {
            name: ["-O", "--optimize"],
            description: "Set the optimization level (default level is 2 if unspecified or 3 if used without a level)",
            args: {
                name: "level",
                description: "Level of optimization"
            }
        },
        {
            name: "-g",
            description: "Enable / Set the level of debug info generation",
            args: {
                name: "level",
                description: "Level of debug info generation"
            }
        },
        {
            name: "--inline",
            description: "Control whether inlining is permitted, including overriding @inline declarations"
        },
        {
            name: "--check-bounds",
            description: "Emit bounds checks always, never, or respect @inbounds declarations"
        },
        {
            name: "--polly",
            description: "Enable or disable the polyhedral optimizer Polly (overrides @polly declaration)"
        },
        {
            name: "--math-mode",
            description: "Disallow or enable unsafe floating point optimizations (overrides @fastmath declaration)"
        },
        // instrumentation options
        {
            name: "--code-coverage",
            description: 'Count executions of source lines (omitting setting is equivalent to "user")'
        },
        {
            name: "--track-allocation",
            description: 'Count bytes allocated by each source line (omitting setting is equivalent to "user")'
        },
        {
            name: "--bug-report",
            description: "Launch a bug report session. It can be used to start a REPL, run a script, or evaluate  expressions. It first tries to use BugReporting.jl installed in current environment and fallbacks to the latest compatible BugReporting.jl if not. For more information, see --bug-report=help",
            args: { name: "KIND" }
        },
        // code generation options
        {
            name: "--compile",
            description: "Enable or disable JIT compiler, or request exhaustive or minimal compilation"
        },
        // compiler output options
        {
            name: "--output-o",
            description: "Generate an object file (including system image data)",
            args: { name: "name" }
        },
        {
            name: "--output-ji",
            description: "Generate a system image data file (.ji)",
            args: { name: "name" }
        },
        // compiler debugging
        {
            name: "--output-unopt-bc",
            description: "Generate unoptimized LLVM bitcode (.bc)",
            args: { name: "name" }
        },
        {
            name: "--output-jit-bc",
            description: "Dump all IR generated by the frontend (not including system image)",
            args: { name: "name" }
        },
        {
            name: "--output-bc",
            description: "Generate LLVM bitcode (.bc)",
            args: { name: "name" }
        },
        {
            name: "--output-asm",
            description: "Generate an assembly file (.s)",
            args: { name: "name" }
        },
        {
            name: "--output-incremental",
            description: "Generate an incremental output file (rather than complete)"
        },
        {
            name: "--image-codegen",
            description: "Force generate code in imaging mode"
        }
    ]
};
export default completionSpec;
