import { clangBase } from "./clang";
import type { CommandSpec, OptionSpec, SubcommandSpec } from "../spec.types";
const colorOption: OptionSpec = {
    name: "--color",
    description: "Enable or disable colored message"
};
const cacheDirOption: OptionSpec = {
    name: "--cache-dir",
    description: "Override path to local Zig cache directory"
};
const globalCacheDirOption: OptionSpec = {
    name: "--global-cache-dir",
    description: "Override path to global Zig cache directory"
};
const stage1Option: OptionSpec = {
    name: "-fstage1",
    description: "Force using bootstrap compiler as the codegen backend"
};
const noStage1Option: OptionSpec = {
    name: "-fno-stage1",
    description: "Prevent using bootstrap compiler as the codegen backend"
};
const zigLibDirOption: OptionSpec = {
    name: "--zig-lib-dir",
    description: "Override path to Zig lib directory"
};
const referenceTraceOption: OptionSpec = {
    name: "-freference-trace",
    description: "How many lines of reference trace should be shown per compile error"
};
const noReferenceTraceOption: OptionSpec = {
    name: "-fno-reference-trace",
    description: "Disable reference trace"
};
const helpOption: OptionSpec = {
    name: ["-h", "--help"],
    description: "Print help and exit"
};
const versionOption: OptionSpec = {
    name: ["-v", "--version"],
    description: "Display the version of this program"
};
const buildOptions: OptionSpec[] = [
    //General Options:
    helpOption,
    {
        name: "--watch",
        description: "Enable compiler REPL"
    },
    colorOption,
    {
        name: "-femit-bin",
        description: "(default) Output machine code"
    },
    {
        name: "-fno-emit-bin",
        description: "Do not output machine code"
    },
    {
        name: "-femit-asm",
        description: "Output .s (assembly code)"
    },
    {
        name: "-fno-emit-asm",
        description: "(default) Do not output .s (assembly code)"
    },
    {
        name: "-femit-llvm-ir",
        description: "Produce a .ll file with LLVM IR (requires LLVM extensions)"
    },
    {
        name: "-fno-emit-llvm-ir",
        description: "(default) Do not produce a .ll file with LLVM IR"
    },
    {
        name: "-femit-llvm-bc",
        description: "Produce a LLVM module as a .bc file (requires LLVM extensions)"
    },
    {
        name: "-fno-emit-llvm-bc",
        description: "(default) Do not produce a LLVM module as a .bc file"
    },
    {
        name: "-femit-h",
        description: "Generate a C header file (.h)"
    },
    {
        name: "-fno-emit-h",
        description: "(default) Do not generate a C header file (.h)"
    },
    {
        name: "-femit-docs",
        description: "Create a docs/ dir with html documentation"
    },
    {
        name: "-fno-emit-docs",
        description: "(default) Do not produce docs/ dir with html documentation"
    },
    {
        name: "-femit-analysis",
        description: "Write analysis JSON file with type information"
    },
    {
        name: "-fno-emit-analysis",
        description: "(default) Do not write analysis JSON file with type information"
    },
    {
        name: "-femit-implib",
        description: "(default) Produce an import .lib when building a Windows DLL"
    },
    {
        name: "-fno-emit-implib",
        description: "Do not produce an import .lib when building a Windows DLL"
    },
    {
        name: "--show-builtin",
        description: 'Output the source of @import("builtin") then exit'
    },
    cacheDirOption,
    globalCacheDirOption,
    zigLibDirOption,
    {
        name: "--enable-cache",
        description: "Output to cache directory; print path to stdout"
    },
    //Compile Options:
    {
        name: "-target",
        description: "<arch><sub>-<os>-<abi> see the targets command"
    },
    {
        name: "-mcpu",
        description: "Specify target CPU and feature set"
    },
    {
        name: "-mcmodel",
        description: "Limit range of code and data virtual addresses"
    },
    {
        name: "-mred-zone",
        description: 'Force-enable the "red-zone"'
    },
    {
        name: "-mnored-zone",
        description: 'Force-disable the "red-zone"'
    },
    {
        name: "-fomit-frame-pointer",
        description: "Omit the stack frame pointer"
    },
    {
        name: "-fno-omit-frame-pointer",
        description: "Store the stack frame pointer"
    },
    {
        name: "-mexec-model",
        description: "(WASI) Execution model"
    },
    {
        name: "--name",
        description: "Override root name (not a file path)"
    },
    {
        name: "-O",
        description: "Choose what to optimize for",
        args: {
            name: "mode"
        }
    },
    {
        name: "--pkg-begin",
        description: "Make pkg available to import and push current pkg",
        args: [
            {
                name: "name"
            },
            {
                name: "path"
            }
        ]
    },
    {
        name: "--pkg-end",
        description: "Pop current pkg"
    },
    {
        name: "--main-pkg-path",
        description: "Set the directory of the root package",
        args: {
            name: "path"
        }
    },
    {
        name: "-fPIC",
        description: "Force-enable Position Independent Code"
    },
    {
        name: "-fno-PIC",
        description: "Force-disable Position Independent Code"
    },
    {
        name: "-fPIE",
        description: "Force-enable Position Independent Executable"
    },
    {
        name: "-fno-PIE",
        description: "Force-disable Position Independent Executable"
    },
    {
        name: "-flto",
        description: "Force-enable Link Time Optimization (requires LLVM extensions)"
    },
    {
        name: "-fno-lto",
        description: "Force-disable Link Time Optimization"
    },
    {
        name: "-fstack-check",
        description: "Enable stack probing in unsafe builds"
    },
    {
        name: "-fno-stack-check",
        description: "Disable stack probing in unsafe builds"
    },
    {
        name: "-fstack-protector",
        description: "Enable stack protection in unsafe builds"
    },
    {
        name: "--fno-stack-protector",
        description: "Disable stack protection in unsafe builds"
    },
    {
        name: "-fsanitize-c",
        description: "Enable C undefined behavior detection in unsafe builds"
    },
    {
        name: "-fno-sanitize-c",
        description: "Disable C undefined behavior detection in safe builds"
    },
    {
        name: "-fvalgrind",
        description: "Include valgrind client requests in release builds"
    },
    {
        name: "-fno-valgrind",
        description: "Omit valgrind client requests in debug builds"
    },
    {
        name: "-fsanitize-thread",
        description: "Enable Thread Sanitizer"
    },
    {
        name: "-fno-sanitize-thread",
        description: "Disable Thread Sanitizer"
    },
    {
        name: "-fdll-export-fns",
        description: "Mark exported functions as DLL exports (Windows)"
    },
    {
        name: "-fno-dll-export-fns",
        description: "Force-disable marking exported functions as DLL exports"
    },
    {
        name: "-funwind-tables",
        description: "Always produce unwind table entries for all functions"
    },
    {
        name: "-fno-unwind-tables",
        description: "Never produce unwind table entries"
    },
    {
        name: "-fLLVM",
        description: "Force using LLVM as the codegen backend"
    },
    {
        name: "-fno-LLVM",
        description: "Prevent using LLVM as the codegen backend"
    },
    {
        name: "-fClang",
        description: "Force using Clang as the C/C++ compilation backend"
    },
    {
        name: "-fno-Clang",
        description: "Prevent using Clang as the C/C++ compilation backend"
    },
    stage1Option,
    noStage1Option,
    referenceTraceOption,
    noReferenceTraceOption,
    {
        name: "-fsingle-threaded",
        description: "Code assumes there is only one thread"
    },
    {
        name: "-fno-single-threaded",
        description: "Code may not assume there is only one thread"
    },
    {
        name: "-fbuiltin",
        description: "Enable implicit builtin knowledge of functions"
    },
    {
        name: "-fno-builtin",
        description: "Disable implicit builtin knowledge of functions"
    },
    {
        name: "-ffunction-sections",
        description: "Places each function in a separate section"
    },
    {
        name: "-fno-function-sections",
        description: "All functions go into same section"
    },
    {
        name: "-fstrip",
        description: "Omit debug symbols"
    },
    {
        name: "-fno-strip",
        description: "Keep debug symbols"
    },
    {
        name: "-ofmt",
        description: "Override target object format",
        args: {
            name: "mode"
        }
    },
    {
        name: "-idirafter",
        description: "Add directory to AFTER include search path",
        args: {
            name: "dir"
        }
    },
    {
        name: "-isystem",
        description: "Add directory to SYSTEM include search path",
        args: {
            name: "dir"
        }
    },
    {
        name: "-I",
        description: "Add directory to include search path"
    },
    {
        name: "-D",
        description: "Define C [macro] to [value] (1 if [value] omitted)"
    },
    {
        name: "--libc",
        description: "Provide a file which specifies libc paths",
        args: {
            name: "file"
        }
    },
    {
        name: "-cflags",
        description: "Set extra flags for the next positional C source files"
    },
    //Link Options:
    {
        name: ["-l", "--library"],
        description: "Link against system library (only if actually used)",
        args: {
            name: "lib"
        }
    },
    {
        name: ["-needed-l", "--needed-library"],
        description: "Link against system library (even if unused)",
        args: {
            name: "lib"
        }
    },
    {
        name: ["-L", "--library-directory"],
        description: "Add a directory to the library search path",
        args: {
            name: "d"
        }
    },
    {
        name: ["-T", "--script"],
        description: "Use a custom linker script",
        args: {
            name: "script"
        }
    },
    {
        name: "--version-script",
        description: "Provide a version .map file",
        args: {
            name: "path"
        }
    },
    {
        name: "--dynamic-linker",
        description: "Set the dynamic interpreter path (usually ld.so)",
        args: {
            name: "path"
        }
    },
    {
        name: "--sysroot",
        description: "Set the system root directory (usually /)",
        args: {
            name: "path"
        }
    },
    {
        name: "--version",
        description: "Dynamic library semver",
        args: {
            name: "ver"
        }
    },
    {
        name: "--entry",
        description: "Set the entrypoint symbol name",
        args: {
            name: "name"
        }
    },
    {
        name: "-fsoname",
        description: "Override the default SONAME value"
    },
    {
        name: "-fno-soname",
        description: "Disable emitting a SONAME"
    },
    {
        name: "-fLLD",
        description: "Force using LLD as the linker"
    },
    {
        name: "-fno-LLD",
        description: "Prevent using LLD as the linker"
    },
    {
        name: "-fcompiler-rt",
        description: "Always include compiler-rt symbols in output"
    },
    {
        name: "-fno-compiler-rt",
        description: "Prevent including compiler-rt symbols in output"
    },
    {
        name: "-rdynamic",
        description: "Add all symbols to the dynamic symbol table"
    },
    {
        name: "-rpath",
        description: "Add directory to the runtime library search path",
        args: {
            name: "path"
        }
    },
    {
        name: "-feach-lib-rpath",
        description: "Ensure adding rpath for each used dynamic library"
    },
    {
        name: "-fno-each-lib-rpath",
        description: "Prevent adding rpath for each used dynamic library"
    },
    {
        name: "-fallow-shlib-undefined",
        description: "Allows undefined symbols in shared libraries"
    },
    {
        name: "-fno-allow-shlib-undefined",
        description: "Disallows undefined symbols in shared libraries"
    },
    {
        name: "-fbuild-id",
        description: "Helps coordinate stripped binaries with debug symbols"
    },
    {
        name: "-fno-build-id",
        description: "(default) Saves a bit of time linking"
    },
    {
        name: "--eh-frame-hdr",
        description: "Enable C++ exception handling by passing --eh-frame-hdr to linker"
    },
    {
        name: "--emit-relocs",
        description: "Enable output of relocation sections for post build tools"
    },
    {
        name: "-z",
        description: "Set linker extension flags",
        args: {
            name: "arg"
        }
    },
    {
        name: "-dynamic",
        description: "Force output to be dynamically linked"
    },
    {
        name: "-static",
        description: "Force output to be statically linked"
    },
    {
        name: "-Bsymbolic",
        description: "Bind global references locally"
    },
    {
        name: "--compress-debug-sections",
        description: "Debug section compression settings",
        args: {
            name: "e"
        }
    },
    {
        name: "--gc-sections",
        description: "Force removal of functions and data that are unreachable by the entry point or exported symbols"
    },
    {
        name: "--no-gc-sections",
        description: "Don't force removal of unreachable functions and data"
    },
    {
        name: "--subsystem",
        description: "(Windows) /SUBSYSTEM:<subsystem> to the linker",
        args: {
            name: "subsystem"
        }
    },
    {
        name: "--stack",
        description: "Override default stack size",
        args: {
            name: "size"
        }
    },
    {
        name: "--image-base",
        description: "Set base address for executable image",
        args: {
            name: "addr",
            description: "Address"
        }
    },
    {
        name: ["-weak-l", "-weak_library"],
        description: "(Darwin) link against system library and mark it and all referenced symbols as weak",
        args: {
            name: "lib"
        }
    },
    {
        name: "-framework",
        description: "(Darwin) link against framework",
        args: {
            name: "name",
            description: "Framework name"
        }
    },
    {
        name: "-needed_framework",
        description: "(Darwin) link against framework (even if unused)",
        args: {
            name: "name",
            description: "Framework name"
        }
    },
    {
        name: "-needed_library",
        description: "(Darwin) link against framework (even if unused)",
        args: {
            name: "lib",
            description: "Library name"
        }
    },
    {
        name: "-weak_framework",
        description: "(Darwin) link against framework and mark it and all referenced symbols as weak",
        args: {
            name: "name",
            description: "Framework name"
        }
    },
    {
        name: "-F",
        description: "(Darwin) add search path for frameworks",
        args: {
            name: "dir"
        }
    },
    {
        name: "-install_name",
        description: "(Darwin) add dylib's install name"
    },
    {
        name: "--entitlements",
        description: "(Darwin) add path to entitlements file for embedding in code signature",
        args: {
            name: "path"
        }
    },
    {
        name: "-pagezero_size",
        description: "(Darwin) size of the __PAGEZERO segment in hexadecimal notation",
        args: {
            name: "value"
        }
    },
    {
        name: "-search_paths_first",
        description: "(Darwin) search each dir in library search paths for `libx.dylib` then `libx.a`"
    },
    {
        name: "-search_dylibs_first",
        description: "(Darwin) search `libx.dylib` in each dir in library search paths, then `libx.a`"
    },
    {
        name: "-headerpad",
        description: "(Darwin) set minimum space for future expansion of the load commands in hexadecimal notation",
        args: {
            name: "value"
        }
    },
    {
        name: "-headerpad_max_install_names",
        description: "(Darwin) set enough space as if all paths were MAXPATHLEN"
    },
    {
        name: "-dead_strip",
        description: "(Darwin) remove functions and data that are unreachable by the entry point or exported symbols"
    },
    {
        name: "-dead_strip_dylibs",
        description: "(Darwin) remove dylibs that are unreachable by the entry point or exported symbols"
    },
    {
        name: "--import-memory",
        description: "(WebAssembly) import memory from the environment"
    },
    {
        name: "--import-table",
        description: "(WebAssembly) import function table from the host environment"
    },
    {
        name: "--export-table",
        description: "(WebAssembly) export function table to the host environment"
    },
    {
        name: "--initial-memory",
        description: "(WebAssembly) initial size of the linear memory"
    },
    {
        name: "--max-memory",
        description: "(WebAssembly) maximum size of the linear memory"
    },
    {
        name: "--shared-memory",
        description: "(WebAssembly) use shared linear memory"
    },
    {
        name: "--global-base",
        description: "(WebAssembly) where to start to place global data"
    },
    {
        name: "--export",
        description: "(WebAssembly) Force a symbol to be exported"
    },
    //Test Options
    {
        name: "--test-filter",
        description: "Skip tests that do not match filter",
        args: {
            name: "filter"
        }
    },
    {
        name: "--test-name-prefix",
        description: "Add prefix to all tests",
        args: {
            name: "text"
        }
    },
    {
        name: "--test-cmd",
        description: "Specify test execution command one arg at a time",
        args: {
            name: "arg"
        }
    },
    {
        name: "--test-cmd-bin",
        description: "Appends test binary path to test cmd args"
    },
    {
        name: "--test-evented-io",
        description: "Runs the test in evented I/O mode"
    },
    {
        name: "--test-no-exec",
        description: "Compiles test binary without running it"
    },
    //Debug Options (Zig Compiler Development)
    {
        name: "-ftime-report",
        description: "Print timing diagnostics"
    },
    {
        name: "-fstack-report",
        description: "Print stack size diagnostics"
    },
    {
        name: "--verbose-link",
        description: "Display linker invocations"
    },
    {
        name: "--verbose-cc",
        description: "Display linker invocations"
    },
    {
        name: "--verbose-air",
        description: "Enable compiler debug output for Zig AIR"
    },
    {
        name: "--verbose-llvm-ir",
        description: "Enable compiler debug output for LLVM IR"
    },
    {
        name: "--verbose-cimport",
        description: "Enable compiler debug output for C imports"
    },
    {
        name: "--verbose-llvm-cpu-features",
        description: "Enable compiler debug output for LLVM CPU features"
    },
    {
        name: "--debug-log",
        description: "Enable printing debug/info log messages for scope",
        args: {
            name: "scope"
        }
    },
    {
        name: "--debug-compile-errors",
        description: "Crash with helpful diagnostics at the first compile error"
    },
    {
        name: "--debug-link-snapshot",
        description: "Enable dumping of the linker's state in JSON format"
    }
];
const llvmOptions: OptionSpec[] = [
    ...(clangBase as SubcommandSpec).options,
    helpOption
];
const completionSpec: CommandSpec = {
    name: "zig",
    description: "Zig is a general-purpose programming language and toolchain for " +
        "maintaining robust, optimal, and reusable software",
    subcommands: [
        {
            name: "build",
            description: "Build project from build.zig",
            subcommands: [
                {
                    name: "install",
                    description: "Copy build artifacts to prefix path"
                },
                {
                    name: "uninstall",
                    description: "Remove build artifacts from prefix path"
                },
                {
                    name: "run",
                    description: "Run the app"
                },
                {
                    name: "test",
                    description: "Run unit tests"
                }
            ],
            options: [
                {
                    name: ["-p", "--prefix"],
                    description: "Override default install prefix",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--prefix-lib-dir",
                    description: "Override default library directory path",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--prefix-exe-dir",
                    description: "Override default executable directory path",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--prefix-include-dir",
                    description: "Override default include directory path",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--sysroot",
                    description: "Set the system root directory (usually /)",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--search-prefix",
                    description: "Add a path to look for binaries, libraries, headers",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "--libc",
                    description: "Provide a file which specifies libc paths",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "-fdarling",
                    description: "Integration with system-installed Darling to execute macOS programs on Linux hosts"
                },
                {
                    name: "-fno-fdarling",
                    description: "No integration with system-installed Darling to execute macOS programs on Linux hosts"
                },
                {
                    name: "-fqemu",
                    description: "Integration with system-installed QEMU to execute foreign-architecture programs on Linux host"
                },
                {
                    name: "-fno-qemu",
                    description: "No integration with system-installed QEMU to execute foreign-architecture programs on Linux host"
                },
                {
                    name: "--glibc-runtimes",
                    description: "Enhances QEMU integration by providing glibc built for multiple foreign architectures",
                    args: {
                        name: "path"
                    }
                },
                {
                    name: "-frosetta",
                    description: "Rely on Rosetta to execute x86_64 programs on ARM64 macOS hosts"
                },
                {
                    name: "-fno-rosetta",
                    description: "Don't rely on Rosetta to execute x86_64 programs on ARM64 macOS hosts"
                },
                {
                    name: "-fwasmtime",
                    description: "Integration with system-installed wasmtime to execute WASI binaries"
                },
                {
                    name: "-fno-wasmtime",
                    description: "No integration with system-installed wasmtime to execute WASI binaries"
                },
                {
                    name: "-fwine",
                    description: "Integration with system-installed Wine to execute Windows programs on Linux hosts"
                },
                {
                    name: "-fno-wine",
                    description: "No integration with system-installed Wine to execute Windows programs on Linux hosts"
                },
                helpOption,
                {
                    name: "--verbose",
                    description: "Print commands before executing them"
                },
                colorOption,
                {
                    name: "--prominent-compile-errors",
                    description: "Output compile errors formatted for a human to read"
                },
                {
                    name: "-Dtarget",
                    description: "The CPU architecture, OS, and ABI to build for"
                },
                {
                    name: "-Dcpu",
                    description: "Target CPU features to add or subtract"
                },
                {
                    name: "-Drelease-safe",
                    description: "Optimizations on and safety on"
                },
                {
                    name: "-Drelease-fast",
                    description: "Optimizations on and safety off"
                },
                {
                    name: "-Drelease-small",
                    description: "Size optimizations on and safety off"
                },
                stage1Option,
                noStage1Option,
                referenceTraceOption,
                noReferenceTraceOption,
                {
                    name: "--build-file",
                    description: "Override path to build.zig"
                },
                cacheDirOption,
                globalCacheDirOption,
                zigLibDirOption,
                {
                    name: "--verbose-link",
                    description: "Enable compiler debug output for linking"
                },
                {
                    name: "--verbose-air",
                    description: "Enable compiler debug output for Zig AIR"
                },
                {
                    name: "--verbose-llvm-ir",
                    description: "Enable compiler debug output for LLVM IR"
                },
                {
                    name: "--verbose-cimport",
                    description: "Enable compiler debug output for C imports"
                },
                {
                    name: "--verbose-cc",
                    description: "Enable compiler debug output for C compilation"
                },
                {
                    name: "--verbose-llvm-cpu-features",
                    description: "Enable compiler debug output for LLVM CPU features"
                }
            ]
        },
        {
            name: "init-exe",
            description: "Initializes a `zig build` project in the current working directory",
            options: [helpOption]
        },
        {
            name: "init-lib",
            description: "Initializes a `zig build` project in the current working directory",
            options: [helpOption]
        },
        {
            name: "ast-check",
            description: "Given a .zig source file, reports any compile errors that " +
                "can be ascertained on the basis of the source code alone, without target " +
                "information or type checking. If [file] is omitted, stdin is used.",
            args: {
                name: "file"
            },
            options: [
                helpOption,
                colorOption,
                {
                    name: "-t",
                    description: "(debug option) Output ZIR in text form to stdout"
                }
            ]
        },
        {
            name: "build-exe",
            description: "Create executable from source or object files",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "build-lib",
            description: "Create library from source or object files",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "build-obj",
            description: "Create library from source or object files",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "fmt",
            description: "Reformat Zig source into canonical form",
            args: {
                name: "files"
            },
            options: [
                helpOption,
                colorOption,
                {
                    name: "--stdin",
                    description: "Format code from stdin; output to stdout"
                },
                {
                    name: "--check",
                    description: "Format code from stdin; output to stdout List non-conforming files and exit with an error"
                },
                {
                    name: "--ast-check",
                    description: "Run zig ast-check on every file"
                },
                {
                    name: "--exclude",
                    description: "Exclude file or directory from formatting",
                    args: {
                        name: "file"
                    }
                }
            ]
        },
        {
            name: "run",
            description: "Create executable and run immediately",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "test",
            description: "Create and run a test build",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "translate-c",
            description: "Convert C code to Zig code",
            options: buildOptions,
            args: {
                name: "files"
            }
        },
        {
            name: "ar",
            description: "LLVM Archiver",
            options: [
                {
                    name: "--format",
                    description: "Archive format to create"
                }
            ]
        },
        {
            name: "cc",
            description: "Use Zig as a drop-in C compiler",
            options: llvmOptions,
            args: {
                name: "file"
            }
        },
        {
            name: "c++",
            description: "Use Zig as a drop-in C++ compiler",
            options: llvmOptions,
            args: {
                name: "file"
            }
        },
        {
            name: "dll-tool",
            description: "LLVM dll tool",
            options: [
                helpOption,
                {
                    name: "-D",
                    description: "Specify the input DLL Name",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-d",
                    description: "Input .def File",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-f",
                    description: "Assembler Flags",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-k",
                    description: "Kill @n Symbol from export"
                },
                {
                    name: "-l",
                    description: "Generate an import lib",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-m",
                    description: "Set target machine",
                    args: {
                        name: "value"
                    }
                },
                {
                    name: "-S",
                    description: "Assembler",
                    args: {
                        name: "value"
                    }
                }
            ]
        },
        {
            name: "lib",
            description: "Use Zig as a drop-in lib.exe"
        },
        {
            name: "ranlib",
            description: "LLVM Ranlib : This program generates an index to speed access to archives",
            options: [
                helpOption,
                versionOption,
                {
                    name: "-D",
                    description: "Use zero for timestamps and uids/gids (default)"
                },
                {
                    name: "-U",
                    description: "Use actual timestamps and uids/gids"
                }
            ]
        },
        {
            name: "env",
            description: "Print lib path, std path, cache directory, and version"
        },
        {
            name: "help",
            description: "Print help and exit"
        },
        {
            name: "libc",
            description: "Detect the native libc installation and print the resulting paths to stdout",
            args: {
                name: "paths_file"
            },
            options: [
                helpOption,
                {
                    name: "-target",
                    description: "<arch><sub>-<os>-<abi> see the targets command",
                    args: {
                        name: "name"
                    }
                }
            ]
        },
        {
            name: "targets",
            description: "List available compilation targets"
        },
        {
            name: "version",
            description: "Print version number and exit"
        },
        {
            name: "zen",
            description: "Print Zen of Zig and exit"
        }
    ],
    options: [helpOption]
};
export default completionSpec;
