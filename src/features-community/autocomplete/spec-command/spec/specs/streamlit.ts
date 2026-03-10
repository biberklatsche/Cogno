import { filepaths } from "@fig/autocomplete-generators";

const completionSpec: CommandSpec = {
  name: "streamlit",
  description: "Streamlit",
  subcommands: [
    {
      name: "activate",
      description: "Activate Streamlit by entering your email",
      icon: "✉️",
    },
    {
      name: "cache",
      description: "Manage the Streamlit cache",
      icon: "🗂",
      subcommands: [
        {
          name: "clear",
          description: "Clear st.cache, st.memo, and st.singleton caches",
          icon: "🗑",
        },
      ],
    },
    {
      name: "config",
      description: "Manage Streamlit's config settings",
      icon: "⚙️",
      subcommands: [
        {
          name: "show",
          description: "Show all of Streamlit's config settings",
          icon: "👀",
        },
      ],
    },
    {
      name: "docs",
      description: "Show help in browser",
      icon: "💡",
    },
    {
      name: "hello",
      description: "Runs the Hello World script",
      icon: "👋,",
    },
    {
      name: "help",
      description: "Print the help message",
      icon: "❓",
    },
    {
      name: "run",
      description: "Run a Python script, piping stderr to Streamlit",
      icon: "🎈",
      args: {
        name: "file",
        description: "The Python script to run",
        generators: filepaths({
          extensions: ["py"],
          editFileSuggestions: { priority: 76 },
        }),
      },
    },
    {
      name: "version",
      description: "Print Streamlit's version number",
      icon: "💯",
    },
  ],
  options: [
    {
      name: "--log_level",
      description: "Set the log level",
      args: {
        suggestions: [
          { name: "error", icon: "🔥" },
          { name: "warning", icon: "⚠️" },
          { name: "info", icon: "ℹ️" },
          { name: "debug", icon: "🐛" },
        ],
      },
    },
    {
      name: "--help",
      description: "Show a help message and exit",
    },
    {
      name: "--version",
      description: "Show the version and exit",
    },
  ],
};
export default completionSpec;
