import { StreamLanguage } from "@codemirror/language";
import { Extension } from "@codemirror/state";

/** Loads a language's CodeMirror support on first use; the packages are heavy. */
export type GitDiffLanguageLoader = () => Promise<Extension>;

/** A language the diff view highlights: what names a file in it, and how to load its support. */
type GitDiffLanguage = {
  readonly filenames?: ReadonlyArray<string>;
  readonly extensions?: ReadonlyArray<string>;
  readonly load: GitDiffLanguageLoader;
};

const LANGUAGES: ReadonlyArray<GitDiffLanguage> = [
  // Official @codemirror language packages
  {
    extensions: ["ts", "tsx", "mts", "cts"],
    load: () =>
      import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  },
  {
    extensions: ["js", "jsx", "mjs", "cjs"],
    load: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  },
  { extensions: ["py"], load: () => import("@codemirror/lang-python").then((m) => m.python()) },
  { extensions: ["rs"], load: () => import("@codemirror/lang-rust").then((m) => m.rust()) },
  {
    extensions: ["cpp", "cc", "cxx", "c", "h", "hpp", "hxx"],
    load: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  },
  { extensions: ["java"], load: () => import("@codemirror/lang-java").then((m) => m.java()) },
  { extensions: ["json"], load: () => import("@codemirror/lang-json").then((m) => m.json()) },
  {
    extensions: ["html", "htm"],
    load: () => import("@codemirror/lang-html").then((m) => m.html()),
  },
  {
    extensions: ["css", "less"],
    load: () => import("@codemirror/lang-css").then((m) => m.css()),
  },
  { extensions: ["go"], load: () => import("@codemirror/lang-go").then((m) => m.go()) },
  { extensions: ["scss"], load: () => import("@codemirror/lang-sass").then((m) => m.sass()) },
  {
    extensions: ["yaml", "yml"],
    load: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  },
  {
    extensions: ["md", "mdx"],
    load: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  },
  { extensions: ["sql"], load: () => import("@codemirror/lang-sql").then((m) => m.sql()) },
  {
    extensions: ["php", "phtml"],
    load: () => import("@codemirror/lang-php").then((m) => m.php()),
  },
  { extensions: ["vue"], load: () => import("@codemirror/lang-vue").then((m) => m.vue()) },
  {
    extensions: ["xml", "svg", "xhtml", "xsd"],
    load: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  },
  // C-like family via legacy-modes
  {
    extensions: ["cs"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) => StreamLanguage.define(m.csharp)),
  },
  {
    extensions: ["kt", "kts"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) => StreamLanguage.define(m.kotlin)),
  },
  {
    extensions: ["scala", "sc"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) => StreamLanguage.define(m.scala)),
  },
  {
    extensions: ["m"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) =>
        StreamLanguage.define(m.objectiveC),
      ),
  },
  {
    extensions: ["mm"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) =>
        StreamLanguage.define(m.objectiveCpp),
      ),
  },
  // Scripting via legacy-modes
  {
    filenames: ["gemfile", "rakefile", "vagrantfile"],
    extensions: ["rb", "rake", "gemspec"],
    load: () =>
      import("@codemirror/legacy-modes/mode/ruby").then((m) => StreamLanguage.define(m.ruby)),
  },
  {
    extensions: ["lua"],
    load: () =>
      import("@codemirror/legacy-modes/mode/lua").then((m) => StreamLanguage.define(m.lua)),
  },
  {
    extensions: ["pl", "pm"],
    load: () =>
      import("@codemirror/legacy-modes/mode/perl").then((m) => StreamLanguage.define(m.perl)),
  },
  {
    extensions: ["coffee"],
    load: () =>
      import("@codemirror/legacy-modes/mode/coffeescript").then((m) =>
        StreamLanguage.define(m.coffeeScript),
      ),
  },
  // Shell / Config
  {
    filenames: [".bashrc", ".zshrc", ".bash_profile", ".zprofile", ".profile"],
    extensions: ["sh", "bash", "zsh", "fish"],
    load: () =>
      import("@codemirror/legacy-modes/mode/shell").then((m) => StreamLanguage.define(m.shell)),
  },
  {
    extensions: ["ps1", "psm1", "psd1"],
    load: () =>
      import("@codemirror/legacy-modes/mode/powershell").then((m) =>
        StreamLanguage.define(m.powerShell),
      ),
  },
  {
    filenames: ["dockerfile"],
    load: () =>
      import("@codemirror/legacy-modes/mode/dockerfile").then((m) =>
        StreamLanguage.define(m.dockerFile),
      ),
  },
  {
    filenames: ["nginx.conf"],
    load: () =>
      import("@codemirror/legacy-modes/mode/nginx").then((m) => StreamLanguage.define(m.nginx)),
  },
  {
    extensions: ["toml"],
    load: () =>
      import("@codemirror/legacy-modes/mode/toml").then((m) => StreamLanguage.define(m.toml)),
  },
  // Systems / Functional
  {
    extensions: ["swift"],
    load: () =>
      import("@codemirror/legacy-modes/mode/swift").then((m) => StreamLanguage.define(m.swift)),
  },
  {
    extensions: ["dart"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clike").then((m) => StreamLanguage.define(m.dart)),
  },
  {
    extensions: ["hs", "lhs"],
    load: () =>
      import("@codemirror/legacy-modes/mode/haskell").then((m) => StreamLanguage.define(m.haskell)),
  },
  {
    extensions: ["r"],
    load: () => import("@codemirror/legacy-modes/mode/r").then((m) => StreamLanguage.define(m.r)),
  },
  {
    extensions: ["jl"],
    load: () =>
      import("@codemirror/legacy-modes/mode/julia").then((m) => StreamLanguage.define(m.julia)),
  },
  {
    extensions: ["elm"],
    load: () =>
      import("@codemirror/legacy-modes/mode/elm").then((m) => StreamLanguage.define(m.elm)),
  },
  {
    extensions: ["clj", "cljs", "cljc"],
    load: () =>
      import("@codemirror/legacy-modes/mode/clojure").then((m) => StreamLanguage.define(m.clojure)),
  },
  {
    extensions: ["erl", "hrl"],
    load: () =>
      import("@codemirror/legacy-modes/mode/erlang").then((m) => StreamLanguage.define(m.erlang)),
  },
  {
    extensions: ["ml", "mli"],
    load: () =>
      import("@codemirror/legacy-modes/mode/mllike").then((m) => StreamLanguage.define(m.oCaml)),
  },
  {
    extensions: ["groovy", "gradle"],
    load: () =>
      import("@codemirror/legacy-modes/mode/groovy").then((m) => StreamLanguage.define(m.groovy)),
  },
  {
    extensions: ["cr"],
    load: () =>
      import("@codemirror/legacy-modes/mode/crystal").then((m) => StreamLanguage.define(m.crystal)),
  },
  {
    extensions: ["proto"],
    load: () =>
      import("@codemirror/legacy-modes/mode/protobuf").then((m) =>
        StreamLanguage.define(m.protobuf),
      ),
  },
];

const BY_FILENAME = new Map(
  LANGUAGES.flatMap((language) => (language.filenames ?? []).map((name) => [name, language.load])),
);
const BY_EXTENSION = new Map(
  LANGUAGES.flatMap((language) =>
    (language.extensions ?? []).map((extension) => [extension, language.load]),
  ),
);

/**
 * The language of a file by its name, then by its extension; undefined for
 * one the diff view shows as plain text.
 */
export function detectGitDiffLanguage(filePath: string): GitDiffLanguageLoader | undefined {
  const filename = (filePath.split("/").pop() ?? filePath).toLowerCase();
  return BY_FILENAME.get(filename) ?? BY_EXTENSION.get(filename.split(".").pop() ?? "");
}
